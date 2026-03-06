-- ============================================================
-- Migration 002: Advanced Security Enhancements
-- ============================================================

-- Account lockout: track failed attempts and lockout duration
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip INET;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes_hash JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trusted_ips JSONB DEFAULT '[]';

-- Security alerts table (per-user security notifications)
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for security_alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_unread ON security_alerts(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

-- Vault item security metadata (track when password was last rotated)
ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Update existing login items to have a default password_changed_at
UPDATE vault_items SET password_changed_at = created_at WHERE item_type = 'login' AND password_changed_at IS NULL;

-- Trusted devices table
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(user_id, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);

-- Index: failed_login_attempts for monitoring
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(locked_until) WHERE locked_until IS NOT NULL;
