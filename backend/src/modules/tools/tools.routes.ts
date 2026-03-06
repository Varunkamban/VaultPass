import { Router } from 'express';
import toolsController from './tools.controller';
import { passwordGenerateLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/password-generate', passwordGenerateLimiter, toolsController.generatePassword.bind(toolsController));
router.post('/breach-check', toolsController.breachCheck.bind(toolsController));
router.get('/health', toolsController.health.bind(toolsController));

export default router;
