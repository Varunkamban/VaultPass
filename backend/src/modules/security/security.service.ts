import { query } from '../../config/database';

export interface SecurityAlert {
  id: string;
  user_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export class SecurityService {
  // ─── Alerts ───────────────────────────────────────────────────

  async getAlerts(
    userId: string,
    options: { unread_only?: boolean; limit?: number; offset?: number } = {}
  ): Promise<{ alerts: SecurityAlert[]; total: number }> {
    const { unread_only = false, limit = 20, offset = 0 } = options;

    const whereClause = unread_only
      ? 'WHERE user_id = $1 AND is_read = false'
      : 'WHERE user_id = $1';

    const [alertsResult, countResult] = await Promise.all([
      query(
        `SELECT id, user_id, alert_type, severity, title, message, metadata, is_read, created_at
         FROM security_alerts ${whereClause}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM security_alerts ${whereClause}`,
        [userId]
      ),
    ]);

    return {
      alerts: alertsResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM security_alerts WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async markAlertRead(userId: string, alertId: string): Promise<void> {
    const result = await query(
      `UPDATE security_alerts SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id`,
      [alertId, userId]
    );
    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'ALERT_NOT_FOUND', message: 'Security alert not found' };
    }
  }

  async markAllAlertsRead(userId: string): Promise<number> {
    const result = await query(
      `UPDATE security_alerts SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  async deleteAlert(userId: string, alertId: string): Promise<void> {
    const result = await query(
      `DELETE FROM security_alerts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [alertId, userId]
    );
    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'ALERT_NOT_FOUND', message: 'Security alert not found' };
    }
  }

  async deleteAllAlerts(userId: string): Promise<number> {
    const result = await query(
      `DELETE FROM security_alerts WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  // ─── Vault Health Score ───────────────────────────────────────
  // Returns a score 0–100 representing the security health of a user's vault

  async getVaultHealthScore(userId: string): Promise<{
    score: number;
    label: string;
    factors: Array<{ name: string; status: 'good' | 'warning' | 'danger'; detail: string }>;
  }> {
    // Gather data
    const [userResult, vaultResult, sessionResult] = await Promise.all([
      query(
        `SELECT mfa_enabled, password_changed_at, backup_codes_hash, account_status
         FROM users WHERE id = $1`,
        [userId]
      ),
      query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE password_changed_at IS NOT NULL
                  AND password_changed_at < NOW() - INTERVAL '180 days') as old_passwords
         FROM vault_items
         WHERE user_id = $1 AND deleted_at IS NULL AND item_type = 'login'`,
        [userId]
      ),
      query(
        `SELECT COUNT(*) as active_sessions
         FROM sessions WHERE user_id = $1 AND revoked = false AND expires_at > NOW()`,
        [userId]
      ),
    ]);

    const user = userResult.rows[0];
    const vaultStats = vaultResult.rows[0];
    const sessionCount = parseInt(sessionResult.rows[0].active_sessions, 10);

    const factors: Array<{ name: string; status: 'good' | 'warning' | 'danger'; detail: string }> = [];
    let score = 100;

    // Factor 1: MFA enabled
    if (user?.mfa_enabled) {
      factors.push({ name: 'Two-Factor Authentication', status: 'good', detail: 'MFA is enabled on your account' });
    } else {
      score -= 25;
      factors.push({ name: 'Two-Factor Authentication', status: 'danger', detail: 'Enable MFA to secure your account' });
    }

    // Factor 2: Backup codes
    const backupCodes: string[] | null = user?.backup_codes_hash;
    if (user?.mfa_enabled) {
      if (backupCodes && backupCodes.length >= 4) {
        factors.push({ name: 'Backup Codes', status: 'good', detail: `${backupCodes.length} backup codes available` });
      } else if (backupCodes && backupCodes.length > 0) {
        score -= 5;
        factors.push({ name: 'Backup Codes', status: 'warning', detail: `Only ${backupCodes.length} backup code(s) remaining – regenerate soon` });
      } else {
        score -= 10;
        factors.push({ name: 'Backup Codes', status: 'warning', detail: 'No backup codes – regenerate them in Settings' });
      }
    }

    // Factor 3: Old passwords in vault
    const totalLogins = parseInt(vaultStats?.total || '0', 10);
    const oldPasswords = parseInt(vaultStats?.old_passwords || '0', 10);
    if (totalLogins === 0) {
      factors.push({ name: 'Password Age', status: 'good', detail: 'No login entries in vault' });
    } else if (oldPasswords === 0) {
      factors.push({ name: 'Password Age', status: 'good', detail: 'All passwords updated recently' });
    } else {
      const pct = Math.round((oldPasswords / totalLogins) * 100);
      score -= Math.min(20, pct / 5);
      factors.push({
        name: 'Password Age',
        status: pct > 50 ? 'danger' : 'warning',
        detail: `${oldPasswords} password(s) haven't been updated in 6+ months`,
      });
    }

    // Factor 4: Active sessions
    if (sessionCount <= 2) {
      factors.push({ name: 'Active Sessions', status: 'good', detail: `${sessionCount} active session(s)` });
    } else if (sessionCount <= 5) {
      score -= 5;
      factors.push({ name: 'Active Sessions', status: 'warning', detail: `${sessionCount} active sessions – review in Sessions tab` });
    } else {
      score -= 10;
      factors.push({ name: 'Active Sessions', status: 'danger', detail: `${sessionCount} active sessions – revoke unused ones` });
    }

    // Factor 5: Unread critical alerts
    const unreadCritical = await query(
      `SELECT COUNT(*) as count FROM security_alerts
       WHERE user_id = $1 AND is_read = false AND severity IN ('high', 'critical')`,
      [userId]
    );
    const criticalCount = parseInt(unreadCritical.rows[0].count, 10);
    if (criticalCount === 0) {
      factors.push({ name: 'Security Alerts', status: 'good', detail: 'No unread critical alerts' });
    } else {
      score -= Math.min(15, criticalCount * 5);
      factors.push({
        name: 'Security Alerts',
        status: 'danger',
        detail: `${criticalCount} unread critical alert(s) require attention`,
      });
    }

    const clampedScore = Math.max(0, Math.round(score));
    let label = 'Excellent';
    if (clampedScore < 40) label = 'At Risk';
    else if (clampedScore < 60) label = 'Needs Attention';
    else if (clampedScore < 80) label = 'Fair';
    else if (clampedScore < 95) label = 'Good';

    return { score: clampedScore, label, factors };
  }
}

export default new SecurityService();
