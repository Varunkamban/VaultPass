import { create } from 'zustand';
import { VaultItem, Folder, DecryptedItem, Tag } from '../types';
import { vaultApi } from '../lib/api';
import { encrypt, decrypt, encryptString, decryptString } from '../lib/crypto';

interface VaultState {
  items: VaultItem[];
  folders: Folder[];
  tags: Tag[];
  isLoading: boolean;
  selectedItem: VaultItem | null;
  masterKey: CryptoKey | null;
  setMasterKey: (key: CryptoKey | null) => void;
  fetchItems: (filters?: Record<string, unknown>) => Promise<void>;
  fetchFolders: () => Promise<void>;
  fetchTags: () => Promise<void>;
  createItem: (decrypted: DecryptedItem, meta: { item_type: string; folder_id?: string; favorite?: boolean; reprompt?: boolean }) => Promise<VaultItem>;
  updateItem: (id: string, decrypted: DecryptedItem, meta: Partial<{ folder_id: string | null; favorite: boolean; reprompt: boolean; revision: number }>) => Promise<VaultItem>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  decryptItem: (item: VaultItem) => Promise<DecryptedItem | null>;
  setSelectedItem: (item: VaultItem | null) => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  items: [],
  folders: [],
  tags: [],
  isLoading: false,
  selectedItem: null,
  masterKey: null,

  setMasterKey: (key) => set({ masterKey: key }),

  decryptItem: async (item: VaultItem): Promise<DecryptedItem | null> => {
    const { masterKey } = get();
    if (!masterKey) return null;
    try {
      const plaintext = await decrypt(item.encrypted_data, item.nonce, masterKey);
      return JSON.parse(plaintext) as DecryptedItem;
    } catch {
      return null;
    }
  },

  fetchItems: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const res = await vaultApi.getItems(filters);
      const { masterKey } = get();
      const items: VaultItem[] = res.data.items;

      // Decrypt all items
      const decryptedItems = await Promise.all(
        items.map(async (item) => {
          if (!masterKey) return item;
          try {
            const plaintext = await decrypt(item.encrypted_data, item.nonce, masterKey);
            return { ...item, decrypted: JSON.parse(plaintext) as DecryptedItem };
          } catch {
            return item;
          }
        })
      );

      set({ items: decryptedItems, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchFolders: async () => {
    try {
      const res = await vaultApi.getFolders();
      const { masterKey } = get();
      const folders: Folder[] = res.data.folders;

      const decryptedFolders = await Promise.all(
        folders.map(async (folder) => {
          if (!masterKey) return folder;
          try {
            const name = await decryptString(folder.name_encrypted, masterKey);
            return { ...folder, name };
          } catch {
            return { ...folder, name: folder.name_encrypted };
          }
        })
      );

      set({ folders: decryptedFolders });
    } catch {
      // ignore
    }
  },

  fetchTags: async () => {
    try {
      const res = await vaultApi.getTags();
      set({ tags: res.data.tags });
    } catch {
      // ignore
    }
  },

  createItem: async (decrypted, meta) => {
    const { masterKey } = get();
    if (!masterKey) throw new Error('No encryption key available');

    const plaintext = JSON.stringify(decrypted);
    const { encrypted, nonce } = await encrypt(plaintext, masterKey);

    const res = await vaultApi.createItem({
      item_type: meta.item_type,
      encrypted_data: encrypted,
      nonce,
      folder_id: meta.folder_id,
      favorite: meta.favorite || false,
      reprompt: meta.reprompt || false,
    });

    const newItem = { ...res.data, decrypted };
    set((state) => ({ items: [newItem, ...state.items] }));
    return newItem;
  },

  updateItem: async (id, decrypted, meta) => {
    const { masterKey } = get();
    if (!masterKey) throw new Error('No encryption key available');

    const plaintext = JSON.stringify(decrypted);
    const { encrypted, nonce } = await encrypt(plaintext, masterKey);

    const res = await vaultApi.updateItem(id, {
      encrypted_data: encrypted,
      nonce,
      ...meta,
    });

    const updated = { ...res.data, decrypted };
    set((state) => ({
      items: state.items.map((item) => item.id === id ? updated : item),
      selectedItem: state.selectedItem?.id === id ? updated : state.selectedItem,
    }));
    return updated;
  },

  deleteItem: async (id) => {
    await vaultApi.deleteItem(id);
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, deleted_at: new Date().toISOString() } : item
      ),
      selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    }));
  },

  restoreItem: async (id) => {
    await vaultApi.restoreItem(id);
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, deleted_at: null } : item
      ),
    }));
  },

  permanentDelete: async (id) => {
    await vaultApi.permanentDelete(id);
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    }));
  },

  emptyTrash: async () => {
    await vaultApi.emptyTrash();
    set((state) => ({
      items: state.items.filter((item) => !item.deleted_at),
    }));
  },

  toggleFavorite: async (id) => {
    const res = await vaultApi.toggleFavorite(id);
    const { favorite } = res.data;
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, favorite } : item
      ),
      selectedItem: state.selectedItem?.id === id
        ? { ...state.selectedItem, favorite }
        : state.selectedItem,
    }));
  },

  createFolder: async (name: string) => {
    const { masterKey } = get();
    if (!masterKey) throw new Error('No encryption key');
    const name_encrypted = await encryptString(name, masterKey);
    const res = await vaultApi.createFolder({ name_encrypted });
    const folder = { ...res.data, name };
    set((state) => ({ folders: [...state.folders, folder] }));
  },

  deleteFolder: async (id: string) => {
    await vaultApi.deleteFolder(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      items: state.items.map((item) =>
        item.folder_id === id ? { ...item, folder_id: null } : item
      ),
    }));
  },

  setSelectedItem: (item) => set({ selectedItem: item }),
}));
