import { Router } from 'express';
import securityController from './security.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All security routes require authentication
router.use(authenticate);

// Vault health score
router.get('/health', securityController.getHealthScore.bind(securityController));

// Security alerts
router.get('/alerts', securityController.getAlerts.bind(securityController));
router.get('/alerts/unread-count', securityController.getUnreadCount.bind(securityController));
router.patch('/alerts/read-all', securityController.markAllAlertsRead.bind(securityController));
router.patch('/alerts/:id/read', securityController.markAlertRead.bind(securityController));
router.delete('/alerts', securityController.deleteAllAlerts.bind(securityController));
router.delete('/alerts/:id', securityController.deleteAlert.bind(securityController));

export default router;
