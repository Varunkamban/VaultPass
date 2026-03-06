import { Router } from 'express';
import vaultController from './vault.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Vault items
router.get('/items', vaultController.getItems.bind(vaultController));
router.post('/items', vaultController.createItem.bind(vaultController));
router.get('/sync', vaultController.syncItems.bind(vaultController));
router.get('/items/:id', vaultController.getItem.bind(vaultController));
router.put('/items/:id', vaultController.updateItem.bind(vaultController));
router.delete('/items/:id', vaultController.deleteItem.bind(vaultController));
router.post('/items/:id/restore', vaultController.restoreItem.bind(vaultController));
router.delete('/items/:id/permanent', vaultController.permanentDelete.bind(vaultController));
router.post('/items/:id/favorite', vaultController.toggleFavorite.bind(vaultController));
router.delete('/trash', vaultController.emptyTrash.bind(vaultController));

// Folders
router.get('/folders', vaultController.getFolders.bind(vaultController));
router.post('/folders', vaultController.createFolder.bind(vaultController));
router.put('/folders/:id', vaultController.updateFolder.bind(vaultController));
router.delete('/folders/:id', vaultController.deleteFolder.bind(vaultController));

// Tags
router.get('/tags', vaultController.getTags.bind(vaultController));
router.post('/tags', vaultController.createTag.bind(vaultController));
router.delete('/tags/:id', vaultController.deleteTag.bind(vaultController));

export default router;
