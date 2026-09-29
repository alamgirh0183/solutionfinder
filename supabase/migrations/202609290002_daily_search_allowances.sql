update public.plan_catalog
set search_limit = 10,
    features = array[
      'AI-powered solution discovery',
      'Personal search history',
      'Saved solutions'
    ]
where id = 'free';

update public.plan_catalog
set search_limit = 100,
    features = array[
      'Everything in Free',
      'Stripe subscription management'
    ]
where id = 'premium';

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
