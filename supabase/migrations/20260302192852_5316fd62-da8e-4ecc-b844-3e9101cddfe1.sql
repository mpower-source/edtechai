-- Enable leaked password protection (HaveIBeenPwned integration)
-- This is a Supabase Auth config setting, not a SQL migration.
-- Setting it via the auth config API instead.
SELECT 1; -- no-op; will use configure-auth tool