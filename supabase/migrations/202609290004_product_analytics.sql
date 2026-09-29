CREATE TABLE IF NOT EXISTS public.product_analytics_daily (
  event_date date NOT NULL,
  event_name text NOT NULL CHECK (event_name IN ('search', 'signup')),
  event_count bigint NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  PRIMARY KEY (event_date, event_name)
);

ALTER TABLE public.product_analytics_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_analytics_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_analytics_daily TO service_role;

INSERT INTO public.product_analytics_daily AS d (event_date, event_name, event_count)
SELECT (u.created_at AT TIME ZONE 'UTC')::date, 'signup', count(*)
FROM auth.users AS u
GROUP BY (u.created_at AT TIME ZONE 'UTC')::date
ON CONFLICT (event_date, event_name)
DO UPDATE SET event_count = EXCLUDED.event_count;

INSERT INTO public.product_analytics_daily (event_date, event_name, event_count)
SELECT (h.created_at AT TIME ZONE 'UTC')::date, 'search', count(*)
FROM public.search_history AS h
WHERE h.status = 'completed'
GROUP BY (h.created_at AT TIME ZONE 'UTC')::date
ON CONFLICT (event_date, event_name)
DO UPDATE SET event_count = EXCLUDED.event_count;

CREATE OR REPLACE FUNCTION public.track_product_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.product_analytics_daily AS d (event_date, event_name, event_count)
  VALUES ((pg_catalog.now() AT TIME ZONE 'UTC')::date, 'signup', 1)
  ON CONFLICT (event_date, event_name)
  DO UPDATE SET event_count = d.event_count + 1;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_signup()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_completed_product_search()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.product_analytics_daily AS d (event_date, event_name, event_count)
    VALUES ((NEW.created_at AT TIME ZONE 'UTC')::date, 'search', 1)
    ON CONFLICT (event_date, event_name)
    DO UPDATE SET event_count = d.event_count + 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_completed_product_search()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS solutionfinder_track_signup ON auth.users;
CREATE TRIGGER solutionfinder_track_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.track_product_signup();

DROP TRIGGER IF EXISTS solutionfinder_track_completed_search ON public.search_history;
CREATE TRIGGER solutionfinder_track_completed_search
AFTER UPDATE OF status ON public.search_history
FOR EACH ROW EXECUTE FUNCTION public.track_completed_product_search();

CREATE OR REPLACE FUNCTION public.record_public_product_search()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.product_analytics_daily AS d (event_date, event_name, event_count)
  VALUES ((pg_catalog.now() AT TIME ZONE 'UTC')::date, 'search', 1)
  ON CONFLICT (event_date, event_name)
  DO UPDATE SET event_count = d.event_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.record_public_product_search()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_public_product_search() TO service_role;
