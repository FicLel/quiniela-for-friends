-- Auth configuration performed in the Supabase dashboard (not applied via SQL migration).
-- Documented here for audit and reproducibility.

-- 1. Email OTP enabled: Authentication > Providers > Email > "Enable Email OTP" = true
-- 2. Self-registration disabled: Authentication > Providers > Email > "Enable Signups" = false
-- 3. OTP expiry: 3600 seconds (60 minutes) — Authentication > Providers > Email > "OTP Expiry"
-- 4. Allowed redirect URLs: http://localhost:3000 added to Authentication > URL Configuration

-- No schema changes to auth.users or public schema are required for this feature.
-- Supabase manages auth.users, auth.sessions, and auth.refresh_tokens internally.
