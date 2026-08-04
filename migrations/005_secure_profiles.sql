-- Migration to secure profiles table from privilege escalation
-- Only allow admins to update role, status, or allow_test_limit

CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) IS DISTINCT FROM 'admin' THEN
      IF OLD.role IS DISTINCT FROM NEW.role OR
         OLD.status IS DISTINCT FROM NEW.status OR
         OLD.allow_test_limit IS DISTINCT FROM NEW.allow_test_limit THEN
        RAISE EXCEPTION 'Only admins can modify role, status, or allow_test_limit.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_profile_update ON public.profiles;

CREATE TRIGGER tr_check_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_update();
