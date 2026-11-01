-- Cash Tech: Postgres (Neon) schema. Safe to run more than once.
CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  brand text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  specs text NOT NULL,
  images text NOT NULL,
  price integer,
  old_price integer,
  available integer NOT NULL DEFAULT 0,
  hidden integer NOT NULL DEFAULT 0,
  sample integer NOT NULL DEFAULT 1,
  featured integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  updated_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY,
  data text NOT NULL,
  version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS admins (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  hash text PRIMARY KEY,
  admin_id text NOT NULL REFERENCES admins(id),
  expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS login_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS uploads (
  key text PRIMARY KEY,
  content_type text NOT NULL,
  data bytea NOT NULL,
  created_at bigint NOT NULL
);
