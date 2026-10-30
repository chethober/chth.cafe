-- Control plane tables. The Worker creates them on first use; this file is for reference and manual setup.
-- There are no control plane accounts: an owner is a Cloudflare account, signed in with OAuth or an API token.
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY, -- SHA-256 of the cookie value, so a database read does not leak live sessions
  owner_id TEXT NOT NULL, -- the Cloudflare account ID
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE TABLE IF NOT EXISTS attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
-- The saved access to each signed-in Cloudflare account; owner_id is the account ID. Credentials are AES-GCM encrypted.
CREATE TABLE IF NOT EXISTS connections (
  owner_id TEXT PRIMARY KEY,
  method TEXT NOT NULL CHECK (method IN ('token', 'oauth')),
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  credentials TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Sign-ins with Cloudflare in progress. The state is also kept in a cookie in the browser that started it.
CREATE TABLE IF NOT EXISTS oauth_logins (
  state_hash TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cafes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  script_name TEXT NOT NULL,
  database_id TEXT,
  kv_namespace_id TEXT,
  custom_domain TEXT,
  url TEXT,
  admin_url TEXT,
  version TEXT,
  status TEXT NOT NULL DEFAULT 'deploying' CHECK (status IN ('deploying', 'live', 'failed')),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (account_id, script_name)
);
CREATE INDEX IF NOT EXISTS idx_cafes_owner ON cafes(owner_id);
-- What the control plane did in each owner's account, for the owner and for support.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  cafe_id TEXT,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_owner ON audit_log(owner_id, id);
-- The line of text cafés show at the top of their admin and panel. scope is 'global' or a café ID;
-- a café's own row overrides the global one, and an empty text hides the line for that café.
CREATE TABLE IF NOT EXISTS notices (
  scope TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  url TEXT,
  updated_at TEXT NOT NULL
);
-- Platform admin sessions (admin.<host>). They end when a deploy sets a new admin password.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id_hash TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
