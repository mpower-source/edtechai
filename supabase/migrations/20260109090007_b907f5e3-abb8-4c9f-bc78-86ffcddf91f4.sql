-- Fix the permissive INSERT policy on analytics_events
-- Remove the current policy that allows anyone to insert
DROP POLICY IF EXISTS "System can insert analytics events" ON public.analytics_events;

-- Create a new policy that only allows authenticated users to insert their own events
-- or allows service role (for server-side insertions)
CREATE POLICY "Users can insert their own analytics events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (
  -- Allow if user_id matches the authenticated user
  (user_id = auth.uid())
  -- Or allow if user_id is null (for anonymous page views etc.) but user is authenticated
  OR (user_id IS NULL AND auth.uid() IS NOT NULL)
);

-- Also fix the notifications table - it doesn't have an INSERT policy issue in the schema
-- but let's ensure notifications can only be read/updated by their owners
-- The notifications table already has proper SELECT and UPDATE policies