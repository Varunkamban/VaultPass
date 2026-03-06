import { Response, NextFunction } from 'express';
import adminService from './admin.service';
import { AuthRequest, AccountStatus } from '../../types';
import authService from '../auth/auth.service';

export class AdminController {
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getStats();
      return res.json(stats);
    } catch (error) {
      return next(error);
    }
  }

  async getUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = req.query.search as string | undefined;

      const result = await adminService.getUsers(page, limit, search);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await adminService.getUserById(req.params.id);
      return res.json(user);
    } catch (error) {
      return next(error);
    }
  }

  async updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const validStatuses: AccountStatus[] = ['active', 'locked', 'suspended', 'deleted'];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Status must be one of: ${validStatuses.join(', ')}` }
        });
      }

      const result = await adminService.updateUserStatus(req.params.id, status);

      await authService.writeAuditLog(
        req.user!.userId, 'ADMIN_USER_STATUS_CHANGED', req.ip || null,
        req.headers['user-agent'] || null, { target_user_id: req.params.id, new_status: status }
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async toggleAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { is_admin } = req.body;
      if (typeof is_admin !== 'boolean') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'is_admin must be a boolean' } });
      }

      const result = await adminService.toggleAdmin(req.params.id, is_admin);

      await authService.writeAuditLog(
        req.user!.userId, 'ADMIN_PRIVILEGE_CHANGED', req.ip || null,
        req.headers['user-agent'] || null, { target_user_id: req.params.id, is_admin }
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getAuditLogs({
        user_id: req.query.user_id as string,
        action: req.query.action as string,
        from: req.query.from as string,
        to: req.query.to as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deleteUser(req.user!.userId, req.params.id);

      await authService.writeAuditLog(
        req.user!.userId, 'ADMIN_USER_DELETED', req.ip || null,
        req.headers['user-agent'] || null, { target_user_id: req.params.id }
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
}

export default new AdminController();
