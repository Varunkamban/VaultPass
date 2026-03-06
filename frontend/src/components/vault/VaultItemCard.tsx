import React, { useState } from 'react';
import {
  Star, Copy, MoreVertical, Edit, Trash2, RotateCcw, Trash,
  LogIn, FileText, CreditCard, User, Terminal, Check
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { VaultItem, ItemType } from '../../types';
import { Badge } from '../ui/Badge';
import { useVaultStore } from '../../store/vaultStore';
import toast from 'react-hot-toast';

interface VaultItemCardProps {
  item: VaultItem;
  isSelected: boolean;
  onSelect: (item: VaultItem) => void;
  onEdit: (item: VaultItem) => void;
  isTrash?: boolean;
}

const itemTypeConfig: Record<ItemType, { icon: LucideIcon; color: string; label: string }> = {
  login: { icon: LogIn, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', label: 'Login' },
  note: { icon: FileText, color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400', label: 'Note' },
  card: { icon: CreditCard, color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', label: 'Card' },
  identity: { icon: User, color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400', label: 'Identity' },
  ssh_key: { icon: Terminal, color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400', label: 'SSH Key' },
};

export const VaultItemCard: React.FC<VaultItemCardProps> = ({
  item,
  isSelected,
  onSelect,
  onEdit,
  isTrash = false,
}) => {
  const { toggleFavorite, deleteItem, restoreItem, permanentDelete } = useVaultStore();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const typeConfig = itemTypeConfig[item.item_type];
  const TypeIcon = typeConfig.icon;
  const name = item.decrypted?.name || 'Untitled';
  const username = item.decrypted?.username || item.decrypted?.email || '';
  const url = item.decrypted?.url || '';

  const getDomain = (url: string) => {
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    } catch {
      return '';
    }
  };

  const copyPassword = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const password = item.decrypted?.password;
    if (!password) return;

    await navigator.clipboard.writeText(password);
    setCopied(true);
    toast.success('Password copied! Clears in 30s');

    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {});
      setCopied(false);
    }, 30000);
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavorite(item.id);
    } catch {
      toast.error('Failed to update favorite');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await deleteItem(item.id);
      toast.success('Moved to trash');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await restoreItem(item.id);
      toast.success('Item restored');
    } catch {
      toast.error('Failed to restore item');
    }
  };

  const handlePermanentDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this item? This cannot be undone.')) return;
    try {
      await permanentDelete(item.id);
      toast.success('Item permanently deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className={`
        group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150
        ${isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
        }
      `}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConfig.color}`}>
        {url ? (
          <img
            src={`https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=32`}
            alt=""
            className="w-5 h-5 rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <TypeIcon size={16} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{name}</p>
        {username && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{username}</p>
        )}
        {!username && url && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{getDomain(url)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isTrash && item.item_type === 'login' && item.decrypted?.password && (
          <button
            onClick={copyPassword}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Copy password"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        )}

        {!isTrash && (
          <button
            onClick={handleToggleFavorite}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              size={14}
              className={item.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}
            />
          </button>
        )}

        {/* More menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreVertical size={14} />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-7 z-50 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
              onBlur={() => setShowMenu(false)}
            >
              {!isTrash && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(item); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Edit size={14} /> Edit
                </button>
              )}
              {isTrash ? (
                <>
                  <button
                    onClick={handleRestore}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                  <button
                    onClick={handlePermanentDelete}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash size={14} /> Delete Forever
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} /> Move to Trash
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
