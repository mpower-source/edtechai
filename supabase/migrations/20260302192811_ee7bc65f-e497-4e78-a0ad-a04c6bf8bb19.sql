-- Fix security definer view: recreate public_profiles as SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  full_name,
  avatar_url,
  bio,
  role,
  created_at,
  updated_at
FROM public.profiles;