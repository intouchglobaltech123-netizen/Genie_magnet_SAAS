-- Times are stored without a time zone and read by the application as UTC, so the database must work in UTC.
-- Otherwise a server set to local time (e.g. Asia/Kolkata) stores "now" 5.5 hours off for every created_at.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not set the database time zone to UTC; set it on the server instead.';
END
$$;
