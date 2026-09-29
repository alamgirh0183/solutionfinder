create table if not exists public.plan_catalog (
  id text primary key check (id in ('free', 'premium')),
  name text not null,
  description text not null,
  price_display text not null,
  currency text not null,
  interval text not null default 'month',
  search_limit integer,
  features text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint plan_catalog_search_limit_valid
    check (search_limit is null or search_limit >= -1)
);

insert into public.plan_catalog
  (id, name, description, price_display, currency, interval, search_limit, features)
values
  ('free', 'Free', 'Explore solution discovery and keep your recommendations organized.',
   'Free', 'CONFIGURE_CURRENCY', 'month', 10,
   array['AI-powered solution discovery', 'Personal search history',
         'Saved solutions']),
  ('premium', 'Premium', 'More room to research, organize, and find the right tools.',
   'CONFIGURE_PREMIUM_PRICE', 'CONFIGURE_CURRENCY', 'month', 100,
   array['Everything in Free', 'Stripe subscription management'])
on conflict (id) do nothing;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem text not null check (char_length(problem) between 1 and 2000),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  response_data jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists search_history_user_created_idx
  on public.search_history (user_id, created_at desc);

create table if not exists public.saved_solutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_search_id uuid not null,
  problem text not null check (char_length(problem) <= 2000),
  solution_name text not null default '' check (char_length(solution_name) <= 300),
  description text not null default '' check (char_length(description) <= 5000),
  solution_url text not null default '' check (char_length(solution_url) <= 2048),
  created_at timestamptz not null default now(),
  constraint saved_solutions_source_owner_fkey
    foreign key (source_search_id, user_id)
    references public.search_history (id, user_id) on delete cascade,
  constraint saved_solutions_unique
    unique (user_id, source_search_id, solution_name, solution_url)
);

create index if not exists saved_solutions_user_created_idx
  on public.saved_solutions (user_id, created_at desc);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.plan_catalog enable row level security;
alter table public.subscriptions enable row level security;
alter table public.search_history enable row level security;
alter table public.saved_solutions enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "Plan catalog is publicly readable" on public.plan_catalog;
create policy "Plan catalog is publicly readable"
  on public.plan_catalog for select to anon, authenticated using (true);

drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read their own searches" on public.search_history;
create policy "Users can read their own searches"
  on public.search_history for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read their own saved solutions" on public.saved_solutions;
create policy "Users can read their own saved solutions"
  on public.saved_solutions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can save their own solutions" on public.saved_solutions;
create policy "Users can save their own solutions"
  on public.saved_solutions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.search_history h
      where h.id = source_search_id
        and h.user_id = (select auth.uid())
        and h.status = 'completed'
    )
  );

drop policy if exists "Users can remove their own saved solutions" on public.saved_solutions;
create policy "Users can remove their own saved solutions"
  on public.saved_solutions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.plan_catalog from anon, authenticated;
grant select on public.plan_catalog to anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
revoke all on public.search_history from anon, authenticated;
grant select on public.search_history to authenticated;
revoke all on public.saved_solutions from anon, authenticated;
grant select, insert, delete on public.saved_solutions to authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.plan_catalog, public.subscriptions, public.search_history,
  public.saved_solutions, public.stripe_webhook_events to service_role;

create or replace function public.reserve_search(p_problem text)
returns table (
  search_id uuid,
  plan_name text,
  used_count integer,
  search_limit integer,
  allowed boolean,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_name text := 'free';
  v_search_limit integer;
  v_used integer;
  v_search_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if p_problem is null or char_length(btrim(p_problem)) not between 1 and 2000 then
    raise exception 'INVALID_SEARCH' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = v_user_id
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  ) then
    v_plan_name := 'premium';
  end if;

  select p.search_limit into v_search_limit
  from public.plan_catalog p
  where p.id = v_plan_name;

  if not found or v_search_limit = -1 then
    return query select null::uuid, v_plan_name, 0, -1, false,
      'PLAN_LIMIT_NOT_CONFIGURED'::text;
    return;
  end if;

  select count(*)::integer into v_used
  from public.search_history h
  where h.user_id = v_user_id
    and h.created_at >= (
      pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    );

  if v_search_limit is not null and v_used >= v_search_limit then
    return query select null::uuid, v_plan_name, v_used, v_search_limit,
      false, 'SEARCH_LIMIT_REACHED'::text;
    return;
  end if;

  insert into public.search_history (user_id, problem)
  values (v_user_id, btrim(p_problem))
  returning id into v_search_id;

  return query select v_search_id, v_plan_name, v_used + 1,
    v_search_limit, true, null::text;
end;
$$;

create or replace function public.get_plan_usage()
returns table (
  plan_name text,
  used_count integer,
  search_limit integer,
  remaining integer,
  configured boolean,
  period_end timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_name text := 'free';
  v_search_limit integer;
  v_used integer;
  v_period_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  select s.current_period_end into v_period_end
  from public.subscriptions s
  where s.user_id = v_user_id
    and s.status in ('active', 'trialing')
    and (s.current_period_end is null or s.current_period_end > now());
  if found then
    v_plan_name := 'premium';
  end if;

  select p.search_limit into v_search_limit
  from public.plan_catalog p
  where p.id = v_plan_name;

  if not found then
    return query select v_plan_name, 0, null::integer, null::integer,
      false, v_period_end;
    return;
  end if;

  select count(*)::integer into v_used
  from public.search_history h
  where h.user_id = v_user_id
    and h.created_at >= (
      pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    );

  return query select
    v_plan_name,
    v_used,
    v_search_limit,
    case when v_search_limit is null or v_search_limit = -1
      then null else greatest(v_search_limit - v_used, 0) end,
    v_search_limit is null or v_search_limit <> -1,
    v_period_end;
end;
$$;

create or replace function public.complete_search(
  p_search_id uuid,
  p_response_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if p_response_data is null then
    raise exception 'INVALID_SEARCH_RESPONSE' using errcode = '22023';
  end if;

  update public.search_history
  set status = 'completed', response_data = p_response_data, error_message = null
  where id = p_search_id and user_id = v_user_id and status = 'pending';
  return found;
end;
$$;

create or replace function public.fail_search(
  p_search_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  update public.search_history
  set status = 'failed',
      error_message = pg_catalog.left(coalesce(p_error_message, 'Search failed.'), 500)
  where id = p_search_id and user_id = v_user_id and status = 'pending';
  return found;
end;
$$;

revoke all on function public.reserve_search(text) from public, anon;
grant execute on function public.reserve_search(text) to authenticated;
revoke all on function public.get_plan_usage() from public, anon;
grant execute on function public.get_plan_usage() to authenticated;
revoke all on function public.complete_search(uuid, jsonb) from public, anon;
grant execute on function public.complete_search(uuid, jsonb) to authenticated;
revoke all on function public.fail_search(uuid, text) from public, anon;
grant execute on function public.fail_search(uuid, text) to authenticated;
