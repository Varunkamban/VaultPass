import { Response, NextFunction } from 'express';
import securityService from './security.service';
import { AuthRequest } from '../../types';
import { isValidUUID } from '../../middleware/inputValidator';

export class SecurityController {
  // GET /api/v1/security/alerts
  async getAlerts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const unread_only = req.query.unread_only === 'true';
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await securityService.getAlerts(req.user!.userId, { unread_only, limit, offset });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/v1/security/alerts/unread-count
  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const count = await securityService.getUnreadCount(req.user!.userId);
      return res.json({ count });
    } catch (error) {
      return next(error);
    }
  }

  // PATCH /api/v1/security/alerts/:id/read
  async markAlertRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: { code: 'INVALID_PARAM', message: 'Invalid alert ID' } });
      }
      await securityService.markAlertRead(req.user!.userId, id);
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  // PATCH /api/v1/security/alerts/read-all
  async markAllAlertsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await securityService.markAllAlertsRead(req.user!.userId);
      return res.json({ success: true, updated });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/v1/security/alerts/:id
  async deleteAlert(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: { code: 'INVALID_PARAM', message: 'Invalid alert ID' } });
      }
      await securityService.deleteAlert(req.user!.userId, id);
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/v1/security/alerts
  async deleteAllAlerts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deleted = await securityService.deleteAllAlerts(req.user!.userId);
      return res.json({ success: true, deleted });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/v1/security/health
  async getHealthScore(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const health = await securityService.getVaultHealthScore(req.user!.userId);
      return res.json(health);
    } catch (error) {
      return next(error);
    }
  }
}

export default new SecurityController();
