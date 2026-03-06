import { Router } from 'express';
import adminController from './admin.controller';
import { authenticate, requireAdmin } from '../../middleware/auth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

router.get('/stats', adminController.getStats.bind(adminController));
router.get('/users', adminController.getUsers.bind(adminController));
router.get('/users/:id', adminController.getUserById.bind(adminController));
router.patch('/users/:id/status', adminController.updateUserStatus.bind(adminController));
router.patch('/users/:id/admin', adminController.toggleAdmin.bind(adminController));
router.delete('/users/:id', adminController.deleteUser.bind(adminController));
router.get('/audit-logs', adminController.getAuditLogs.bind(adminController));

export default router;
