-- Runs once, on the first start of the local Postgres container.
-- genie_owner owns the schema and runs migrations.
-- genie_app is what the API and worker connect as: it cannot bypass row-level security.
CREATE ROLE genie_app LOGIN PASSWORD 'genie_app_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE genie TO genie_app;

-- genie_auth is what Better Auth connects as: sign-in tables only, never business data.
CREATE ROLE genie_auth LOGIN PASSWORD 'genie_auth_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE genie TO genie_auth;

CREATE DATABASE genie_test OWNER genie_owner;
GRANT CONNECT ON DATABASE genie_test TO genie_app;
GRANT CONNECT ON DATABASE genie_test TO genie_auth;
