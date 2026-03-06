import { Router } from 'express';
import authController from './auth.controller';
import * as oauthController from './oauth.controller';
import { authenticate } from '../../middleware/auth';
import { loginLimiter, registrationLimiter, passwordResetLimiter } from '../../middleware/rateLimiter';

const router = Router();

// ── Microsoft SSO routes (browser redirects — no auth middleware) ─────────────
router.get('/oauth/microsoft', oauthController.initiateOAuth);
router.get('/oauth/microsoft/callback', oauthController.handleCallback);

// Public routes
router.post('/register', registrationLimiter, authController.register.bind(authController));
router.get('/prelogin', authController.prelogin.bind(authController));
router.post('/login', loginLimiter, authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));

// Protected routes
router.post('/logout', authenticate, authController.logout.bind(authController));
router.get('/me', authenticate, authController.me.bind(authController));

// MFA routes
router.post('/mfa/setup', authenticate, authController.setupMfa.bind(authController));
router.post('/mfa/verify', authenticate, authController.verifyMfa.bind(authController));
router.post('/mfa/disable', authenticate, authController.disableMfa.bind(authController));

// Backup codes
router.get('/mfa/backup-codes/count', authenticate, authController.getBackupCodesCount.bind(authController));
router.post('/mfa/backup-codes/regenerate', authenticate, passwordResetLimiter, authController.regenerateBackupCodes.bind(authController));

// Password & sessions
router.post('/change-password', authenticate, passwordResetLimiter, authController.changePassword.bind(authController));
router.get('/sessions', authenticate, authController.getSessions.bind(authController));
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession.bind(authController));

// Trust current IP (marks current IP as trusted to suppress suspicious login alerts)
router.post('/trust-ip', authenticate, authController.trustIp.bind(authController));

export default router;
