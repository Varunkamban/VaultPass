import { Response, NextFunction } from 'express';
import vaultService from './vault.service';
import { AuthRequest, VaultItemFilter } from '../../types';
import authService from '../auth/auth.service';

export class VaultController {
  async getItems(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters: VaultItemFilter = {
        type: req.query.type as VaultItemFilter['type'],
        folder_id: req.query.folder_id as string,
        favorite: req.query.favorite === 'true' ? true : undefined,
        tag_id: req.query.tag_id as string,
        deleted: req.query.deleted === 'true',
      };
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await vaultService.getItems(req.user!.userId, filters, page, limit);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await vaultService.getItem(req.user!.userId, req.params.id);
      return res.json(item);
    } catch (error) {
      return next(error);
    }
  }

  async createItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { item_type, encrypted_data, nonce, folder_id, favorite, reprompt } = req.body;

      if (!item_type || !encrypted_data || !nonce) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'item_type, encrypted_data, and nonce are required' } });
      }

      const item = await vaultService.createItem(req.user!.userId, {
        item_type, encrypted_data, nonce, folder_id, favorite, reprompt,
      });

      await authService.writeAuditLog(
        req.user!.userId, 'VAULT_ITEM_CREATED', req.ip || null,
        req.headers['user-agent'] || null, { item_id: item.id, item_type }
      );

      return res.status(201).json(item);
    } catch (error) {
      return next(error);
    }
  }

  async updateItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { encrypted_data, nonce, folder_id, favorite, reprompt, revision } = req.body;

      if (revision === undefined) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'revision is required for updates' } });
      }

      const item = await vaultService.updateItem(req.user!.userId, req.params.id, {
        encrypted_data, nonce, folder_id, favorite, reprompt, revision,
      });

      await authService.writeAuditLog(
        req.user!.userId, 'VAULT_ITEM_UPDATED', req.ip || null,
        req.headers['user-agent'] || null, { item_id: req.params.id }
      );

      return res.json(item);
    } catch (error) {
      return next(error);
    }
  }

  async deleteItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.deleteItem(req.user!.userId, req.params.id);
      await authService.writeAuditLog(
        req.user!.userId, 'VAULT_ITEM_DELETED', req.ip || null,
        req.headers['user-agent'] || null, { item_id: req.params.id }
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async restoreItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.restoreItem(req.user!.userId, req.params.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async permanentDelete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.permanentDelete(req.user!.userId, req.params.id);
      await authService.writeAuditLog(
        req.user!.userId, 'VAULT_ITEM_PERMANENTLY_DELETED', req.ip || null,
        req.headers['user-agent'] || null, { item_id: req.params.id }
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async emptyTrash(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.emptyTrash(req.user!.userId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async syncItems(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const since = req.query.since as string || new Date(0).toISOString();
      const items = await vaultService.syncItems(req.user!.userId, since);
      return res.json({ items, synced_at: new Date().toISOString() });
    } catch (error) {
      return next(error);
    }
  }

  async toggleFavorite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.toggleFavorite(req.user!.userId, req.params.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  // Folders
  async getFolders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const folders = await vaultService.getFolders(req.user!.userId);
      return res.json({ folders });
    } catch (error) {
      return next(error);
    }
  }

  async createFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name_encrypted, parent_id } = req.body;
      if (!name_encrypted) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name_encrypted is required' } });
      }
      const folder = await vaultService.createFolder(req.user!.userId, { name_encrypted, parent_id });
      return res.status(201).json(folder);
    } catch (error) {
      return next(error);
    }
  }

  async updateFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const folder = await vaultService.updateFolder(req.user!.userId, req.params.id, req.body);
      return res.json(folder);
    } catch (error) {
      return next(error);
    }
  }

  async deleteFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.deleteFolder(req.user!.userId, req.params.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  // Tags
  async getTags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tags = await vaultService.getTags(req.user!.userId);
      return res.json({ tags });
    } catch (error) {
      return next(error);
    }
  }

  async createTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name_encrypted } = req.body;
      if (!name_encrypted) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name_encrypted is required' } });
      }
      const tag = await vaultService.createTag(req.user!.userId, name_encrypted);
      return res.status(201).json(tag);
    } catch (error) {
      return next(error);
    }
  }

  async deleteTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await vaultService.deleteTag(req.user!.userId, req.params.id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
}

export default new VaultController();
