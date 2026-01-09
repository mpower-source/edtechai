-- Fix 1: Create a secure view for public profile access that excludes email
-- This allows public profile viewing without exposing sensitive email addresses

CREATE OR REPLACE VIEW public.public_profiles AS 
SELECT 
  id, 
  full_name, 
  avatar_url, 
  role, 
  bio, 
  created_at, 
  updated_at 
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Update the RLS policy to require authentication for full profile access with email
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Allow authenticated users to see all profile data (including their own email)
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Keep the existing policy for users to update their own profile
-- (already exists: "Users can update own profile")