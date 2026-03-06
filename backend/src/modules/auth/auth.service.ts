import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { query } from '../../config/database';
import { env } from '../../config/env';
import { User, JwtPayload } from '../../types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export class AuthService {
  // ─── Token Helpers ────────────────────────────────────────────
  private generateTokens(user: User) {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
      type: 'access',
    };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as string,
    } as jwt.SignOptions);

    const refreshPayload: JwtPayload = { ...payload, type: 'refresh' };
    const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as string,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }

  private async storeSession(userId: string, refreshToken: string, deviceInfo: Record<string, unknown> = {}) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO sessions (user_id, token_hash, device_info, expires_at) VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, JSON.stringify(deviceInfo), expiresAt]
    );
  }

  // ─── Security Alert Helper ────────────────────────────────────
  async createSecurityAlert(
    userId: string,
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    message: string,
    metadata: Record<string, unknown> = {}
  ) {
    try {
      await query(
        `INSERT INTO security_alerts (user_id, alert_type, severity, title, message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, alertType, severity, title, message, JSON.stringify(metadata)]
      );
    } catch {
      // Non-fatal: don't break login flow if alert creation fails
    }
  }

  // ─── Audit Log ────────────────────────────────────────────────
  async writeAuditLog(
    userId: string | null,
    action: string,
    ipAddress: string | null,
    userAgent: string | null,
    metadata: Record<string, unknown> = {}
  ) {
    await query(
      `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, ipAddress, userAgent, JSON.stringify(metadata)]
    );
  }

  // ─── Register ─────────────────────────────────────────────────
  async register(email: string, password: string, kdfSalt?: string, deviceInfo: Record<string, unknown> = {}) {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw { statusCode: 409, code: 'EMAIL_EXISTS', message: 'An account with this email already exists' };
    }

    const authHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const salt = kdfSalt || crypto.randomBytes(32).toString('hex');

    const result = await query(
      `INSERT INTO users (email, auth_hash, kdf_salt, kdf_iterations)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, mfa_enabled, is_admin, created_at, account_status, kdf_salt`,
      [email.toLowerCase(), authHash, salt, 100000]
    );

    const user = result.rows[0] as User;
    const { accessToken, refreshToken } = this.generateTokens(user);
    await this.storeSession(user.id, refreshToken, deviceInfo);

    return {
      user: {
        id: user.id, email: user.email, mfa_enabled: user.mfa_enabled,
        is_admin: user.is_admin, created_at: user.created_at,
        account_status: user.account_status, kdf_salt: salt,
      },
      accessToken,
      refreshToken,
    };
  }

  // ─── Pre-login (fetch KDF salt, prevents enumeration) ─────────
  async prelogin(email: string) {
    const result = await query(
      `SELECT kdf_salt, kdf_iterations FROM users WHERE email = $1 AND account_status != 'deleted'`,
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      const fakeSalt = crypto.createHmac('sha256', 'vaultpass-salt-v1').update(email.toLowerCase()).digest('hex');
      return { kdf_salt: fakeSalt, kdf_iterations: 100000 };
    }
    return { kdf_salt: result.rows[0].kdf_salt, kdf_iterations: result.rows[0].kdf_iterations };
  }

  // ─── Login (with lockout + suspicious login detection) ────────
  async login(
    email: string,
    password: string,
    mfaToken?: string,
    backupCode?: string,
    deviceInfo: Record<string, unknown> = {}
  ) {
    const result = await query(
      `SELECT id, email, auth_hash, mfa_enabled, mfa_secret_encrypted, backup_codes_hash,
              is_admin, account_status, kdf_salt, kdf_iterations,
              failed_login_attempts, locked_until, last_login_ip, trusted_ips
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Constant-time dummy hash to prevent timing-based email enumeration
      await bcrypt.compare('dummy_timing_prevention', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LJtzMrNBxuD4H2uNO');
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
    }

    const user = result.rows[0];
    const ip = (deviceInfo as { ip?: string }).ip || null;
    const ua = (deviceInfo as { userAgent?: string }).userAgent || null;

    // ── Account status checks ──
    if (user.account_status === 'deleted') {
      throw { statusCode: 401, code: 'ACCOUNT_DELETED', message: 'Account not found' };
    }
    if (user.account_status === 'suspended') {
      throw { statusCode: 403, code: 'ACCOUNT_SUSPENDED', message: 'Account suspended. Contact support.' };
    }

    // ── Temporary lockout from failed attempts ──
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      await this.writeAuditLog(user.id, 'LOGIN_BLOCKED_LOCKOUT', ip, ua, { locked_until: user.locked_until });
      throw {
        statusCode: 423,
        code: 'ACCOUNT_TEMPORARILY_LOCKED',
        message: `Too many failed attempts. Account locked for ${mins} more minute(s).`,
        retry_after_minutes: mins,
      };
    }

    if (user.account_status === 'locked') {
      throw { statusCode: 403, code: 'ACCOUNT_LOCKED', message: 'Account locked. Contact support.' };
    }

    // ── Password verification ──
    const passwordValid = await bcrypt.compare(password, user.auth_hash);
    if (!passwordValid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [attempts, lockedUntil, user.id]
      );
      await this.writeAuditLog(user.id, 'LOGIN_FAILED', ip, ua, { attempt_number: attempts });

      if (shouldLock) {
        await this.createSecurityAlert(user.id, 'ACCOUNT_LOCKED', 'high',
          'Account Temporarily Locked',
          `Your account was locked after ${MAX_FAILED_ATTEMPTS} failed login attempts. It will unlock in 30 minutes.`,
          { ip, failed_attempts: attempts }
        );
        throw {
          statusCode: 423,
          code: 'ACCOUNT_TEMPORARILY_LOCKED',
          message: 'Account locked for 30 minutes due to too many failed attempts.',
          retry_after_minutes: 30,
        };
      }

      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`,
        attempts_remaining: remaining,
      };
    }

    // ── MFA verification ──
    if (user.mfa_enabled && user.mfa_secret_encrypted) {
      const hasMfaToken = Boolean(mfaToken);
      const hasBackupCode = Boolean(backupCode);

      if (!hasMfaToken && !hasBackupCode) {
        throw { statusCode: 200, code: 'MFA_REQUIRED', message: 'MFA token or backup code required' };
      }

      if (hasMfaToken) {
        const secret = user.mfa_secret_encrypted.toString('utf-8');
        const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: mfaToken!, window: 2 });
        if (!verified) {
          await this.writeAuditLog(user.id, 'MFA_FAILED', ip, ua, {});
          throw { statusCode: 401, code: 'INVALID_MFA_TOKEN', message: 'Invalid authenticator code' };
        }
      } else if (hasBackupCode) {
        const codeValid = await this.consumeBackupCode(user.id, backupCode!);
        if (!codeValid) {
          await this.writeAuditLog(user.id, 'BACKUP_CODE_FAILED', ip, ua, {});
          throw { statusCode: 401, code: 'INVALID_BACKUP_CODE', message: 'Invalid or already-used backup code' };
        }
        await this.writeAuditLog(user.id, 'BACKUP_CODE_USED', ip, ua, {});
        await this.createSecurityAlert(user.id, 'BACKUP_CODE_USED', 'medium',
          'Backup Code Used for Login',
          'A one-time backup code was used to sign in. Consider regenerating your backup codes.',
          { ip }
        );
      }
    }

    // ── Suspicious login detection ──
    const lastIp = user.last_login_ip;
    const trustedIps: string[] = Array.isArray(user.trusted_ips) ? user.trusted_ips : [];
    const isSuspiciousIp = Boolean(ip && lastIp && lastIp !== ip && !trustedIps.includes(ip));

    // Reset lockout counters and update tracking
    await query(
      `UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL, last_login_ip = $1 WHERE id = $2`,
      [ip, user.id]
    );

    if (isSuspiciousIp) {
      await this.writeAuditLog(user.id, 'SUSPICIOUS_LOGIN', ip, ua, { previous_ip: lastIp, new_ip: ip });
      await this.createSecurityAlert(user.id, 'SUSPICIOUS_LOGIN', 'high',
        'New Sign-in Location Detected',
        `Your account was accessed from a new IP address (${ip}). Previous IP: ${lastIp}. If this wasn't you, change your password immediately.`,
        { previous_ip: lastIp, new_ip: ip, user_agent: ua }
      );
    }

    const { accessToken, refreshToken } = this.generateTokens(user as User);
    await this.storeSession(user.id, refreshToken, deviceInfo);
    await this.writeAuditLog(user.id, 'USER_LOGIN', ip, ua, { suspicious: isSuspiciousIp });

    return {
      user: {
        id: user.id, email: user.email, mfa_enabled: user.mfa_enabled,
        is_admin: user.is_admin, account_status: user.account_status,
        kdf_salt: user.kdf_salt, kdf_iterations: user.kdf_iterations,
      },
      accessToken,
      refreshToken,
      suspicious_login: isSuspiciousIp,
    };
  }

  // ─── Refresh Token ────────────────────────────────────────────
  async refreshToken(token: string) {
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' };
    }

    if (decoded.type !== 'refresh') throw { statusCode: 401, code: 'INVALID_TOKEN_TYPE', message: 'Invalid token type' };

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionResult = await query(
      `SELECT s.id, u.id as user_id, u.email, u.is_admin, u.account_status
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.revoked = false AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (sessionResult.rows.length === 0) throw { statusCode: 401, code: 'SESSION_REVOKED', message: 'Session has been revoked or expired' };

    const session = sessionResult.rows[0];
    if (session.account_status !== 'active') throw { statusCode: 403, code: 'ACCOUNT_INACTIVE', message: 'Account is not active' };

    const user = { id: session.user_id, email: session.email, is_admin: session.is_admin } as User;
    const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user);

    await query('UPDATE sessions SET revoked = true WHERE token_hash = $1', [tokenHash]);
    await this.storeSession(session.user_id, newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ─── Logout ───────────────────────────────────────────────────
  async logout(userId: string, refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query('UPDATE sessions SET revoked = true WHERE user_id = $1 AND token_hash = $2', [userId, tokenHash]);
  }

  async logoutAll(userId: string) {
    await query('UPDATE sessions SET revoked = true WHERE user_id = $1', [userId]);
  }

  // ─── MFA Setup / Verify / Disable ─────────────────────────────
  async setupMfa(userId: string) {
    const user = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };

    const secret = speakeasy.generateSecret({ name: `VaultPass (${user.rows[0].email})`, issuer: 'VaultPass', length: 32 });
    await query('UPDATE users SET mfa_secret_encrypted = $1 WHERE id = $2', [Buffer.from(secret.base32, 'utf-8'), userId]);

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url || '');
    return { secret: secret.base32, qrCode: qrCodeDataUrl, otpAuthUrl: secret.otpauth_url };
  }

  async verifyMfa(userId: string, token: string) {
    const result = await query('SELECT mfa_secret_encrypted FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0 || !result.rows[0].mfa_secret_encrypted) {
      throw { statusCode: 400, code: 'MFA_NOT_SETUP', message: 'MFA not configured' };
    }

    const secret = result.rows[0].mfa_secret_encrypted.toString('utf-8');
    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 2 });
    if (!verified) throw { statusCode: 401, code: 'INVALID_MFA_TOKEN', message: 'Invalid MFA token' };

    // Generate backup codes simultaneously when enabling MFA
    const backupCodes = await this.generateBackupCodes(userId);
    await query('UPDATE users SET mfa_enabled = true WHERE id = $1', [userId]);

    return { enabled: true, backup_codes: backupCodes };
  }

  async disableMfa(userId: string, password: string) {
    const result = await query('SELECT auth_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) throw { statusCode: 404, message: 'User not found' };

    const valid = await bcrypt.compare(password, result.rows[0].auth_hash);
    if (!valid) throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid password' };

    await query('UPDATE users SET mfa_enabled = false, mfa_secret_encrypted = NULL, backup_codes_hash = NULL WHERE id = $1', [userId]);
    return { disabled: true };
  }

  // ─── Backup Codes ─────────────────────────────────────────────
  async generateBackupCodes(userId: string): Promise<string[]> {
    // 8 codes, format: XXXX-XXXX-XXXX (12 hex chars per code)
    const codes = Array.from({ length: 8 }, () => {
      const bytes = crypto.randomBytes(6);
      const hex = bytes.toString('hex').toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    });

    // Bcrypt each code individually (rounds=10 for speed)
    const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
    await query('UPDATE users SET backup_codes_hash = $1 WHERE id = $2', [JSON.stringify(hashed), userId]);

    return codes; // Show to user ONCE – never again
  }

  async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    const result = await query('SELECT auth_hash FROM users WHERE id = $1', [userId]);
    const valid = await bcrypt.compare(password, result.rows[0].auth_hash);
    if (!valid) throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid password' };
    return this.generateBackupCodes(userId);
  }

  private async consumeBackupCode(userId: string, code: string): Promise<boolean> {
    const result = await query('SELECT backup_codes_hash FROM users WHERE id = $1', [userId]);
    if (!result.rows[0]?.backup_codes_hash) return false;

    const hashes: string[] = result.rows[0].backup_codes_hash;
    const normalised = code.trim().toUpperCase();
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(normalised, hashes[i])) {
        const remaining = hashes.filter((_, idx) => idx !== i);
        await query('UPDATE users SET backup_codes_hash = $1 WHERE id = $2', [JSON.stringify(remaining), userId]);
        if (remaining.length <= 2) {
          await this.createSecurityAlert(userId, 'BACKUP_CODES_LOW', 'medium',
            'Backup Codes Running Low',
            `Only ${remaining.length} backup code(s) remaining. Regenerate them in Security Settings.`, {}
          );
        }
        return true;
      }
    }
    return false;
  }

  async getBackupCodesCount(userId: string): Promise<number> {
    const result = await query('SELECT backup_codes_hash FROM users WHERE id = $1', [userId]);
    return (result.rows[0]?.backup_codes_hash as string[] | null)?.length ?? 0;
  }

  // ─── Password Change ──────────────────────────────────────────
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const result = await query('SELECT auth_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) throw { statusCode: 404, message: 'User not found' };

    const valid = await bcrypt.compare(currentPassword, result.rows[0].auth_hash);
    if (!valid) throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' };

    const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await query('UPDATE users SET auth_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);
    await this.logoutAll(userId);

    await this.createSecurityAlert(userId, 'PASSWORD_CHANGED', 'medium',
      'Master Password Changed',
      'Your master password was changed and all sessions were signed out. If you did not do this, contact support immediately.',
      {}
    );
    return { success: true };
  }

  // ─── Sessions ─────────────────────────────────────────────────
  async getActiveSessions(userId: string) {
    const result = await query(
      `SELECT id, device_info, created_at, expires_at FROM sessions
       WHERE user_id = $1 AND revoked = false AND expires_at > NOW() ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async revokeSession(userId: string, sessionId: string) {
    await query('UPDATE sessions SET revoked = true WHERE id = $1 AND user_id = $2', [sessionId, userId]);
  }

  // ─── Trust IP ─────────────────────────────────────────────────
  async trustIp(userId: string, ip: string) {
    await query(
      `UPDATE users SET trusted_ips = (COALESCE(trusted_ips, '[]'::jsonb) || to_jsonb($1::text)) WHERE id = $2`,
      [ip, userId]
    );
  }

  // ─── Microsoft SSO Login / Register ───────────────────────────
  // Called after the OAuth2 code exchange completes successfully.
  // Finds an existing SSO user by OID, or creates a new account.
  // Returns an error code string (no throw) when the email conflicts with a local account.
  async ssoLogin(
    microsoftOid: string,
    microsoftTid: string,
    email: string,
    deviceInfo: Record<string, unknown> = {}
  ): Promise<
    | { error: 'EMAIL_EXISTS' }
    | {
        error: null;
        user: Record<string, unknown>;
        accessToken: string;
        refreshToken: string;
        ssoVaultSecret: string;
        kdfSalt: string;
        kdfIterations: number;
      }
  > {
    const ip = (deviceInfo as { ip?: string }).ip || null;
    const ua = (deviceInfo as { userAgent?: string }).userAgent || null;
    const normalEmail = email.toLowerCase();

    // 1. Look up by stable Microsoft OID first
    let userRow = (
      await query(
        `SELECT id, email, is_admin, account_status, kdf_salt, kdf_iterations,
                sso_vault_secret, auth_provider
         FROM users WHERE microsoft_oid = $1`,
        [microsoftOid]
      )
    ).rows[0];

    if (!userRow) {
      // 2. No OID match — check if the email belongs to a LOCAL account
      const byEmail = await query(
        `SELECT auth_provider FROM users WHERE email = $1`,
        [normalEmail]
      );
      if (byEmail.rows.length > 0 && byEmail.rows[0].auth_provider === 'local') {
        return { error: 'EMAIL_EXISTS' };
      }

      // 3. Create a brand-new SSO account
      const kdfSalt = crypto.randomBytes(32).toString('hex');
      const ssoVaultSecret = crypto.randomBytes(64).toString('hex');
      // Sentinel auth_hash — never used for login, satisfies NOT NULL constraint
      const sentinelHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

      const inserted = await query(
        `INSERT INTO users
           (email, auth_hash, kdf_salt, kdf_iterations, auth_provider, microsoft_oid, microsoft_tid, sso_vault_secret)
         VALUES ($1, $2, $3, $4, 'microsoft', $5, $6, $7)
         RETURNING id, email, is_admin, account_status, kdf_salt, kdf_iterations, sso_vault_secret`,
        [normalEmail, sentinelHash, kdfSalt, 100000, microsoftOid, microsoftTid, ssoVaultSecret]
      );
      userRow = inserted.rows[0];

      await this.writeAuditLog(userRow.id, 'SSO_REGISTER', ip, ua, { provider: 'microsoft' });
    } else {
      // 4. Existing SSO user — refresh last_login tracking
      await query(
        `UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`,
        [ip, userRow.id]
      );
      await this.writeAuditLog(userRow.id, 'SSO_LOGIN', ip, ua, { provider: 'microsoft' });
    }

    const { accessToken, refreshToken } = this.generateTokens(userRow as User);
    await this.storeSession(userRow.id, refreshToken, deviceInfo);

    return {
      error: null,
      user: {
        id: userRow.id,
        email: userRow.email,
        is_admin: userRow.is_admin,
        account_status: userRow.account_status,
        auth_provider: 'microsoft',
        kdf_salt: userRow.kdf_salt,
        kdf_iterations: userRow.kdf_iterations,
      },
      accessToken,
      refreshToken,
      ssoVaultSecret: userRow.sso_vault_secret as string,
      kdfSalt: userRow.kdf_salt as string,
      kdfIterations: userRow.kdf_iterations as number,
    };
  }
}

export default new AuthService();
