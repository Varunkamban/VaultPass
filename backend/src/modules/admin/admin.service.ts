import { query } from '../../config/database';
import { AccountStatus } from '../../types';

export class AdminService {
  async getUsers(page = 1, limit = 20, search?: string) {
    const params: unknown[] = [];
    let whereClause = "WHERE account_status != 'deleted'";
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND email ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    const offset = (page - 1) * limit;

    const [usersResult, countResult] = await Promise.all([
      query(
        `SELECT id, email, mfa_enabled, is_admin, created_at, last_login_at, account_status
         FROM users ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM users ${whereClause}`, params),
    ]);

    return {
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  async getUserById(userId: string) {
    const result = await query(
      `SELECT id, email, mfa_enabled, is_admin, created_at, last_login_at, account_status, kdf_iterations
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }

    // Get vault item count
    const itemCount = await query(
      'SELECT COUNT(*) FROM vault_items WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    return {
      ...result.rows[0],
      vault_item_count: parseInt(itemCount.rows[0].count, 10),
    };
  }

  async updateUserStatus(userId: string, status: AccountStatus) {
    const result = await query(
      `UPDATE users SET account_status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, email, account_status`,
      [status, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }

    return result.rows[0];
  }

  async toggleAdmin(userId: string, isAdmin: boolean) {
    const result = await query(
      `UPDATE users SET is_admin = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, email, is_admin`,
      [isAdmin, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }

    return result.rows[0];
  }

  async getAuditLogs(filters: {
    user_id?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (filters.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.user_id);
    }
    if (filters.action) {
      conditions.push(`action ILIKE $${paramIndex++}`);
      params.push(`%${filters.action}%`);
    }
    if (filters.from) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 500);
    const offset = (page - 1) * limit;

    const [logsResult, countResult] = await Promise.all([
      query(
        `SELECT a.id, a.user_id, u.email, a.action, a.ip_address, a.user_agent, a.metadata, a.timestamp
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         ${whereClause}
         ORDER BY a.timestamp DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, params),
    ]);

    return {
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  async getStats() {
    const [
      totalUsers, activeUsers, totalItems, recentLogins, adminUsers
    ] = await Promise.all([
      query("SELECT COUNT(*) FROM users WHERE account_status != 'deleted'"),
      query("SELECT COUNT(*) FROM users WHERE account_status = 'active'"),
      query('SELECT COUNT(*) FROM vault_items WHERE deleted_at IS NULL'),
      query("SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours'"),
      query('SELECT COUNT(*) FROM users WHERE is_admin = true'),
    ]);

    return {
      total_users: parseInt(totalUsers.rows[0].count, 10),
      active_users: parseInt(activeUsers.rows[0].count, 10),
      total_vault_items: parseInt(totalItems.rows[0].count, 10),
      recent_logins_24h: parseInt(recentLogins.rows[0].count, 10),
      admin_users: parseInt(adminUsers.rows[0].count, 10),
    };
  }

  async deleteUser(adminId: string, userId: string) {
    if (adminId === userId) {
      throw { statusCode: 400, code: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own account' };
    }

    const result = await query(
      `UPDATE users SET account_status = 'deleted', updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }

    return { deleted: true };
  }
}

export default new AdminService();
