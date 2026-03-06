-- ============================================================
-- Migration 003: Microsoft SSO Support
-- ============================================================

-- Track whether an account was created via email/password or Microsoft SSO.
-- 'local'     = traditional master-password account (default for all existing rows).
-- 'microsoft' = SSO account provisioned via Azure AD / Microsoft Entra ID.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'
  CHECK (auth_provider IN ('local', 'microsoft'));

-- The Microsoft Object ID ('oid' claim from the ID token).
-- Stable, per-user, per-application GUID — the canonical identity key for SSO users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_oid VARCHAR(128);

-- The Microsoft Tenant ID ('tid' claim) — for auditing and future tenant-level policies.
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_tid VARCHAR(128);

-- Server-managed vault key material for SSO users (64 hex chars = 256 bits of entropy).
-- NULL for local accounts (they use a client-derived key from the master password).
-- NOTE: This column intentionally stores the key material in plaintext because the
-- zero-knowledge guarantee is consciously waived for SSO accounts (accepted by the user).
-- The value is only returned to the authenticated account owner over HTTPS.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_vault_secret VARCHAR(128);

-- Each Microsoft OID may only map to one VaultPass account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_oid
  ON users(microsoft_oid)
  WHERE microsoft_oid IS NOT NULL;

-- Speed up provider-based lookups (e.g. "find all SSO users").
CREATE INDEX IF NOT EXISTS idx_users_auth_provider
  ON users(auth_provider);
