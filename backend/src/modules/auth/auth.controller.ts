import { Request, Response, NextFunction } from 'express';
import authService from './auth.service';
import { AuthRequest } from '../../types';
import { isValidEmail, isValidPassword } from '../../middleware/inputValidator';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, kdf_salt } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } });
      }
      const pwCheck = isValidPassword(password);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: pwCheck.reason } });
      }

      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      };

      const result = await authService.register(email, password, kdf_salt, deviceInfo);

      await authService.writeAuditLog(
        result.user.id, 'USER_REGISTERED', req.ip || null,
        req.headers['user-agent'] || null, { email }
      );

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async prelogin(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required' } });
      }
      const result = await authService.prelogin(email);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, mfa_token, backup_code } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
      }

      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      };

      const result = await authService.login(email, password, mfa_token, backup_code, deviceInfo);

      await authService.writeAuditLog(
        result.user.id, 'USER_LOGIN', req.ip || null,
        req.headers['user-agent'] || null, {}
      );

      return res.json(result);
    } catch (error: unknown) {
      const err = error as { statusCode?: number; code?: string; message?: string };
      if (err.code === 'MFA_REQUIRED') {
        return res.status(200).json({ mfa_required: true });
      }
      if (err.code === 'ACCOUNT_TEMPORARILY_LOCKED') {
        return res.status(423).json({ error: err });
      }
      return next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' } });
      }
      const result = await authService.refreshToken(refresh_token);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body;
      if (req.user && refresh_token) {
        await authService.logout(req.user.userId, refresh_token);
        await authService.writeAuditLog(
          req.user.userId, 'USER_LOGOUT', req.ip || null,
          req.headers['user-agent'] || null, {}
        );
      }
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  async setupMfa(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.setupMfa(req.user!.userId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async verifyMfa(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'MFA token is required' } });
      }
      const result = await authService.verifyMfa(req.user!.userId, token);
      await authService.writeAuditLog(
        req.user!.userId, 'MFA_ENABLED', req.ip || null,
        req.headers['user-agent'] || null, {}
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async disableMfa(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password is required' } });
      }
      const result = await authService.disableMfa(req.user!.userId, password);
      await authService.writeAuditLog(
        req.user!.userId, 'MFA_DISABLED', req.ip || null,
        req.headers['user-agent'] || null, {}
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getBackupCodesCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const count = await authService.getBackupCodesCount(req.user!.userId);
      return res.json({ count });
    } catch (error) {
      return next(error);
    }
  }

  async regenerateBackupCodes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password is required to regenerate backup codes' } });
      }
      const codes = await authService.regenerateBackupCodes(req.user!.userId, password);
      await authService.writeAuditLog(
        req.user!.userId, 'BACKUP_CODES_REGENERATED', req.ip || null,
        req.headers['user-agent'] || null, {}
      );
      await authService.createSecurityAlert(
        req.user!.userId, 'BACKUP_CODES_REGENERATED', 'low',
        'Backup Codes Regenerated',
        'New backup codes were generated. Your old codes are no longer valid.',
        {}
      );
      return res.json({ backup_codes: codes });
    } catch (error) {
      return next(error);
    }
  }

  async trustIp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.body.ip;
      if (!ip) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'IP address could not be determined' } });
      }
      await authService.trustIp(req.user!.userId, ip);
      await authService.writeAuditLog(
        req.user!.userId, 'IP_TRUSTED', req.ip || null,
        req.headers['user-agent'] || null, { trusted_ip: ip }
      );
      return res.json({ success: true, trusted_ip: ip });
    } catch (error) {
      return next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Current and new passwords are required' } });
      }
      const pwCheck = isValidPassword(new_password);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: pwCheck.reason } });
      }
      const result = await authService.changePassword(req.user!.userId, current_password, new_password);
      await authService.writeAuditLog(
        req.user!.userId, 'PASSWORD_CHANGED', req.ip || null,
        req.headers['user-agent'] || null, {}
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sessions = await authService.getActiveSessions(req.user!.userId);
      return res.json({ sessions });
    } catch (error) {
      return next(error);
    }
  }

  async revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await authService.revokeSession(req.user!.userId, sessionId);
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { query } = await import('../../config/database');
      const result = await query(
        `SELECT id, email, mfa_enabled, is_admin, created_at, last_login_at, account_status, kdf_salt, kdf_iterations
         FROM users WHERE id = $1`,
        [req.user!.userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      }
      return res.json({ user: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  }
}

export default new AuthController();
