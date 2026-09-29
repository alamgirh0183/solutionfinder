DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.plan_catalog
    WHERE id = 'free'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM public.plan_catalog
    WHERE id = 'premium'
  ) THEN
    RAISE EXCEPTION
      'Both Free and Premium plan_catalog rows must exist';
  END IF;
END;
$$;

UPDATE public.plan_catalog
SET search_limit = 10
WHERE id = 'free';

UPDATE public.plan_catalog
SET search_limit = 100
WHERE id = 'premium';

UPDATE public.plan_catalog AS p
SET features = ARRAY(
  SELECT u.feature
  FROM unnest(p.features) AS u(feature)
  WHERE pg_catalog.left(u.feature, 10) <> 'CONFIGURE_'
)
WHERE p.id IN ('free', 'premium');


CREATE OR REPLACE FUNCTION public.reserve_search(p_problem text)
RETURNS TABLE (
  search_id uuid,
  plan_name text,
  used_count integer,
  search_limit integer,
  allowed boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan_name text := 'free';
  v_search_limit integer;
  v_used integer;
  v_search_id uuid;
  v_plan_found boolean;
  v_month_start timestamptz;
  v_next_month_start timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'
      USING ERRCODE = '28000';
  END IF;

  IF p_problem IS NULL
     OR char_length(btrim(p_problem)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'INVALID_SEARCH'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions AS s
    WHERE s.user_id = v_user_id
      AND s.status IN ('active', 'trialing')
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end > pg_catalog.now()
  ) THEN
    v_plan_name := 'premium';
  END IF;

  SELECT p.search_limit
  INTO v_search_limit
  FROM public.plan_catalog AS p
  WHERE p.id = v_plan_name;

  v_plan_found := FOUND;

  IF NOT v_plan_found
     OR v_search_limit IS NULL
     OR v_search_limit < 0 THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      v_plan_name,
      0,
      v_search_limit,
      false,
      'PLAN_LIMIT_NOT_CONFIGURED'::text;
    RETURN;
  END IF;

  v_month_start := (
    pg_catalog.date_trunc(
      'month',
      pg_catalog.now() AT TIME ZONE 'UTC'
    ) AT TIME ZONE 'UTC'
  );

  v_next_month_start := (
    (
      pg_catalog.date_trunc(
        'month',
        pg_catalog.now() AT TIME ZONE 'UTC'
      ) + interval '1 month'
    ) AT TIME ZONE 'UTC'
  );

  SELECT count(*)::integer
  INTO v_used
  FROM public.search_history AS h
  WHERE h.user_id = v_user_id
    AND h.created_at >= v_month_start
    AND h.created_at < v_next_month_start;

  IF v_used >= v_search_limit THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      v_plan_name,
      v_used,
      v_search_limit,
      false,
      'SEARCH_LIMIT_REACHED'::text;
    RETURN;
  END IF;

  INSERT INTO public.search_history (user_id, problem)
  VALUES (v_user_id, btrim(p_problem))
  RETURNING id INTO v_search_id;

  RETURN QUERY
  SELECT
    v_search_id,
    v_plan_name,
    v_used + 1,
    v_search_limit,
    true,
    NULL::text;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_plan_usage()
RETURNS TABLE (
  plan_name text,
  used_count integer,
  search_limit integer,
  remaining integer,
  configured boolean,
  period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan_name text := 'free';
  v_search_limit integer;
  v_used integer;
  v_period_end timestamptz;
  v_plan_found boolean;
  v_month_start timestamptz;
  v_next_month_start timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'
      USING ERRCODE = '28000';
  END IF;

  SELECT s.current_period_end
  INTO v_period_end
  FROM public.subscriptions AS s
  WHERE s.user_id = v_user_id
    AND s.status IN ('active', 'trialing')
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end > pg_catalog.now()
  ORDER BY s.current_period_end DESC
  LIMIT 1;

  IF FOUND THEN
    v_plan_name := 'premium';
  END IF;

  SELECT p.search_limit
  INTO v_search_limit
  FROM public.plan_catalog AS p
  WHERE p.id = v_plan_name;

  v_plan_found := FOUND;

  v_month_start := (
    pg_catalog.date_trunc(
      'month',
      pg_catalog.now() AT TIME ZONE 'UTC'
    ) AT TIME ZONE 'UTC'
  );

  v_next_month_start := (
    (
      pg_catalog.date_trunc(
        'month',
        pg_catalog.now() AT TIME ZONE 'UTC'
      ) + interval '1 month'
    ) AT TIME ZONE 'UTC'
  );

  SELECT count(*)::integer
  INTO v_used
  FROM public.search_history AS h
  WHERE h.user_id = v_user_id
    AND h.created_at >= v_month_start
    AND h.created_at < v_next_month_start;

  IF NOT v_plan_found
     OR v_search_limit IS NULL
     OR v_search_limit < 0 THEN
    RETURN QUERY
    SELECT
      v_plan_name,
      v_used,
      v_search_limit,
      NULL::integer,
      false,
      v_period_end;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_plan_name,
    v_used,
    v_search_limit,
    greatest(v_search_limit - v_used, 0),
    true,
    v_period_end;
END;
$$;


REVOKE ALL ON FUNCTION public.reserve_search(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_search(text)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_plan_usage()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_plan_usage()
TO authenticated;