import { query } from '../../config/database';
import { VaultItem, Folder, CreateVaultItemDto, UpdateVaultItemDto, CreateFolderDto, VaultItemFilter } from '../../types';

export class VaultService {
  async getItems(userId: string, filters: VaultItemFilter = {}, page = 1, limit = 50) {
    const conditions: string[] = ['v.user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (filters.deleted) {
      conditions.push('v.deleted_at IS NOT NULL');
    } else {
      conditions.push('v.deleted_at IS NULL');
    }

    if (filters.type) {
      conditions.push(`v.item_type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.folder_id) {
      conditions.push(`v.folder_id = $${paramIndex++}`);
      params.push(filters.folder_id);
    }

    if (filters.favorite === true) {
      conditions.push('v.favorite = true');
    }

    if (filters.tag_id) {
      conditions.push(`EXISTS (SELECT 1 FROM vault_item_tags vt WHERE vt.vault_item_id = v.id AND vt.tag_id = $${paramIndex++})`);
      params.push(filters.tag_id);
    }

    const offset = (page - 1) * limit;
    const whereClause = conditions.join(' AND ');

    const [itemsResult, countResult] = await Promise.all([
      query(
        `SELECT v.id, v.item_type, v.encrypted_data, v.nonce, v.folder_id,
                v.favorite, v.reprompt, v.revision, v.created_at, v.updated_at, v.deleted_at
         FROM vault_items v
         WHERE ${whereClause}
         ORDER BY v.updated_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM vault_items v WHERE ${whereClause}`, params),
    ]);

    return {
      items: itemsResult.rows as VaultItem[],
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  async getItem(userId: string, itemId: string) {
    const result = await query(
      `SELECT id, item_type, encrypted_data, nonce, folder_id, favorite, reprompt, revision, created_at, updated_at, deleted_at
       FROM vault_items
       WHERE id = $1 AND user_id = $2`,
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'ITEM_NOT_FOUND', message: 'Vault item not found' };
    }

    return result.rows[0] as VaultItem;
  }

  async createItem(userId: string, dto: CreateVaultItemDto) {
    const result = await query(
      `INSERT INTO vault_items (user_id, item_type, encrypted_data, nonce, folder_id, favorite, reprompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, item_type, encrypted_data, nonce, folder_id, favorite, reprompt, revision, created_at, updated_at`,
      [
        userId,
        dto.item_type,
        dto.encrypted_data,
        dto.nonce,
        dto.folder_id || null,
        dto.favorite || false,
        dto.reprompt || false,
      ]
    );

    return result.rows[0] as VaultItem;
  }

  async updateItem(userId: string, itemId: string, dto: UpdateVaultItemDto) {
    // Check item exists and revision matches (optimistic concurrency)
    const existing = await this.getItem(userId, itemId);
    if (existing.deleted_at) {
      throw { statusCode: 400, code: 'ITEM_DELETED', message: 'Cannot update a deleted item' };
    }
    if (existing.revision !== dto.revision) {
      throw { statusCode: 409, code: 'REVISION_CONFLICT', message: 'Item has been modified by another session' };
    }

    const updates: string[] = ['revision = revision + 1', 'updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.encrypted_data !== undefined) {
      updates.push(`encrypted_data = $${paramIndex++}`);
      params.push(dto.encrypted_data);
    }
    if (dto.nonce !== undefined) {
      updates.push(`nonce = $${paramIndex++}`);
      params.push(dto.nonce);
    }
    if (dto.folder_id !== undefined) {
      updates.push(`folder_id = $${paramIndex++}`);
      params.push(dto.folder_id);
    }
    if (dto.favorite !== undefined) {
      updates.push(`favorite = $${paramIndex++}`);
      params.push(dto.favorite);
    }
    if (dto.reprompt !== undefined) {
      updates.push(`reprompt = $${paramIndex++}`);
      params.push(dto.reprompt);
    }

    params.push(itemId, userId);
    const result = await query(
      `UPDATE vault_items SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING id, item_type, encrypted_data, nonce, folder_id, favorite, reprompt, revision, created_at, updated_at`,
      params
    );

    return result.rows[0] as VaultItem;
  }

  async deleteItem(userId: string, itemId: string) {
    // Soft delete
    const result = await query(
      `UPDATE vault_items SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'ITEM_NOT_FOUND', message: 'Vault item not found' };
    }

    return { id: itemId, deleted: true };
  }

  async restoreItem(userId: string, itemId: string) {
    const result = await query(
      `UPDATE vault_items SET deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL
       RETURNING id`,
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'ITEM_NOT_FOUND', message: 'Vault item not found in trash' };
    }

    return { id: itemId, restored: true };
  }

  async permanentDelete(userId: string, itemId: string) {
    const result = await query(
      `DELETE FROM vault_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL
       RETURNING id`,
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'ITEM_NOT_FOUND', message: 'Item not found in trash' };
    }

    return { id: itemId, permanently_deleted: true };
  }

  async emptyTrash(userId: string) {
    const result = await query(
      `DELETE FROM vault_items WHERE user_id = $1 AND deleted_at IS NOT NULL`,
      [userId]
    );
    return { deleted_count: result.rowCount };
  }

  async syncItems(userId: string, since: string) {
    const result = await query(
      `SELECT id, item_type, encrypted_data, nonce, folder_id, favorite, reprompt, revision, created_at, updated_at, deleted_at
       FROM vault_items
       WHERE user_id = $1 AND updated_at > $2
       ORDER BY updated_at ASC`,
      [userId, since]
    );
    return result.rows as VaultItem[];
  }

  async toggleFavorite(userId: string, itemId: string) {
    const result = await query(
      `UPDATE vault_items SET favorite = NOT favorite, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id, favorite`,
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'ITEM_NOT_FOUND', message: 'Vault item not found' };
    }

    return result.rows[0];
  }

  // Folders
  async getFolders(userId: string) {
    const result = await query(
      `SELECT id, name_encrypted, parent_id, created_at, updated_at
       FROM folders WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows as Folder[];
  }

  async createFolder(userId: string, dto: CreateFolderDto) {
    if (dto.parent_id) {
      const parent = await query(
        'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
        [dto.parent_id, userId]
      );
      if (parent.rows.length === 0) {
        throw { statusCode: 404, code: 'FOLDER_NOT_FOUND', message: 'Parent folder not found' };
      }
    }

    const result = await query(
      `INSERT INTO folders (user_id, name_encrypted, parent_id)
       VALUES ($1, $2, $3)
       RETURNING id, name_encrypted, parent_id, created_at, updated_at`,
      [userId, dto.name_encrypted, dto.parent_id || null]
    );

    return result.rows[0] as Folder;
  }

  async updateFolder(userId: string, folderId: string, dto: Partial<CreateFolderDto>) {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.name_encrypted) {
      updates.push(`name_encrypted = $${paramIndex++}`);
      params.push(dto.name_encrypted);
    }
    if (dto.parent_id !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`);
      params.push(dto.parent_id || null);
    }

    params.push(folderId, userId);
    const result = await query(
      `UPDATE folders SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING id, name_encrypted, parent_id, created_at, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'FOLDER_NOT_FOUND', message: 'Folder not found' };
    }

    return result.rows[0] as Folder;
  }

  async deleteFolder(userId: string, folderId: string) {
    // Move items in this folder to no folder
    await query(
      'UPDATE vault_items SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2',
      [folderId, userId]
    );

    const result = await query(
      'DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id',
      [folderId, userId]
    );

    if (result.rows.length === 0) {
      throw { statusCode: 404, code: 'FOLDER_NOT_FOUND', message: 'Folder not found' };
    }

    return { id: folderId, deleted: true };
  }

  // Tags
  async getTags(userId: string) {
    const result = await query(
      'SELECT id, name_encrypted, created_at FROM tags WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  }

  async createTag(userId: string, nameEncrypted: string) {
    const result = await query(
      'INSERT INTO tags (user_id, name_encrypted) VALUES ($1, $2) RETURNING id, name_encrypted, created_at',
      [userId, nameEncrypted]
    );
    return result.rows[0];
  }

  async deleteTag(userId: string, tagId: string) {
    await query('DELETE FROM tags WHERE id = $1 AND user_id = $2', [tagId, userId]);
    return { deleted: true };
  }

  async addTagToItem(userId: string, itemId: string, tagId: string) {
    // Verify ownership
    await this.getItem(userId, itemId);
    await query(
      'INSERT INTO vault_item_tags (vault_item_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [itemId, tagId]
    );
    return { added: true };
  }

  async removeTagFromItem(userId: string, itemId: string, tagId: string) {
    await this.getItem(userId, itemId);
    await query(
      'DELETE FROM vault_item_tags WHERE vault_item_id = $1 AND tag_id = $2',
      [itemId, tagId]
    );
    return { removed: true };
  }
}

export default new VaultService();
