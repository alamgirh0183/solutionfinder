CREATE TABLE IF NOT EXISTS public.public_search_rate_limits (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  window_start timestamptz NOT NULL,
  used_count integer NOT NULL CHECK (used_count > 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS public_search_rate_limits_updated_idx
  ON public.public_search_rate_limits (updated_at);

ALTER TABLE public.public_search_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_search_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_search_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_public_search(
  p_fingerprint text,
  p_limit integer
)
RETURNS TABLE (
  allowed boolean,
  used_count integer,
  remaining integer,
  reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_window_start timestamptz := (
    pg_catalog.date_trunc('hour', pg_catalog.now() AT TIME ZONE 'UTC')
    AT TIME ZONE 'UTC'
  );
  v_existing_window timestamptz;
  v_used integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT_FINGERPRINT'
      USING ERRCODE = '22023';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_SEARCH_LIMIT'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_fingerprint, 0)
  );

  SELECT r.window_start, r.used_count
  INTO v_existing_window, v_used
  FROM public.public_search_rate_limits AS r
  WHERE r.fingerprint = p_fingerprint;

  IF NOT FOUND THEN
    INSERT INTO public.public_search_rate_limits
      (fingerprint, window_start, used_count, updated_at)
    VALUES (p_fingerprint, v_window_start, 1, v_now);
    v_used := 1;
  ELSIF v_existing_window < v_window_start THEN
    UPDATE public.public_search_rate_limits AS r
    SET window_start = v_window_start, used_count = 1, updated_at = v_now
    WHERE r.fingerprint = p_fingerprint;
    v_used := 1;
  ELSE
    UPDATE public.public_search_rate_limits AS r
    SET used_count = LEAST(r.used_count + 1, 2147483647),
        updated_at = v_now
    WHERE r.fingerprint = p_fingerprint
    RETURNING r.used_count INTO v_used;
  END IF;

  IF pg_catalog.random() < 0.01 THEN
    DELETE FROM public.public_search_rate_limits AS r
    WHERE r.updated_at < v_now - interval '7 days';
  END IF;

  RETURN QUERY
  SELECT
    v_used <= p_limit,
    v_used,
    GREATEST(p_limit - v_used, 0),
    v_window_start + interval '1 hour';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_public_search(text, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_public_search(text, integer)
TO service_role;
