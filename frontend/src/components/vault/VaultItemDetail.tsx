import React, { useState } from 'react';
import {
  X, Copy, Eye, EyeOff, Edit, Trash2, Star, Check,
  ExternalLink, Shield, Calendar, RefreshCw
} from 'lucide-react';
import { VaultItem } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useVaultStore } from '../../store/vaultStore';
import toast from 'react-hot-toast';

interface VaultItemDetailProps {
  item: VaultItem;
  onClose: () => void;
  onEdit: (item: VaultItem) => void;
}

const FieldRow: React.FC<{
  label: string;
  value: string;
  sensitive?: boolean;
  isUrl?: boolean;
}> = ({ label, value, sensitive = false, isUrl = false }) => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    if (sensitive) {
      toast.success('Copied! Clears in 30s');
      setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
        setCopied(false);
      }, 30000);
    } else {
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayValue = sensitive && !visible ? '••••••••••' : value;

  return (
    <div className="group">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
        <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
          {displayValue}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isUrl && (
            <a
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-gray-400 hover:text-primary-500 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          )}
          {sensitive && (
            <button
              onClick={() => setVisible(!visible)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <button
            onClick={copy}
            className="p-1 rounded text-gray-400 hover:text-primary-500 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export const VaultItemDetail: React.FC<VaultItemDetailProps> = ({ item, onClose, onEdit }) => {
  const { deleteItem, toggleFavorite } = useVaultStore();
  const d = item.decrypted;

  const handleDelete = async () => {
    if (!confirm('Move this item to trash?')) return;
    try {
      await deleteItem(item.id);
      toast.success('Moved to trash');
      onClose();
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite(item.id);
    } catch {
      toast.error('Failed to update favorite');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 dark:text-white truncate">
            {d?.name || 'Untitled'}
          </h2>
          <Badge color="blue" size="sm">
            {item.item_type.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        <button
          onClick={handleToggleFavorite}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Star
            size={16}
            className={item.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}
          />
        </button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Edit size={14} />}
          onClick={() => onEdit(item)}
        >
          Edit
        </Button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Login fields */}
        {item.item_type === 'login' && d && (
          <>
            {d.name && <FieldRow label="Name" value={d.name} />}
            {d.username && <FieldRow label="Username" value={d.username} />}
            {d.password && <FieldRow label="Password" value={d.password} sensitive />}
            {d.url && <FieldRow label="URL" value={d.url} isUrl />}
            {d.notes && <FieldRow label="Notes" value={d.notes} />}
          </>
        )}

        {/* Note fields */}
        {item.item_type === 'note' && d && (
          <>
            {d.name && <FieldRow label="Name" value={d.name} />}
            {d.notes && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Content
                </p>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {d.notes}
                </div>
              </div>
            )}
          </>
        )}

        {/* Card fields */}
        {item.item_type === 'card' && d && (
          <>
            {d.name && <FieldRow label="Card Name" value={d.name} />}
            {d.cardHolder && <FieldRow label="Cardholder" value={d.cardHolder} />}
            {d.cardNumber && <FieldRow label="Card Number" value={d.cardNumber} sensitive />}
            {d.expiry && <FieldRow label="Expiry" value={d.expiry} />}
            {d.cvv && <FieldRow label="CVV" value={d.cvv} sensitive />}
            {d.notes && <FieldRow label="Notes" value={d.notes} />}
          </>
        )}

        {/* Identity fields */}
        {item.item_type === 'identity' && d && (
          <>
            {d.name && <FieldRow label="Name" value={d.name} />}
            {d.firstName && <FieldRow label="First Name" value={d.firstName} />}
            {d.lastName && <FieldRow label="Last Name" value={d.lastName} />}
            {d.email && <FieldRow label="Email" value={d.email} />}
            {d.phone && <FieldRow label="Phone" value={d.phone} />}
            {d.address && <FieldRow label="Address" value={d.address} />}
            {d.notes && <FieldRow label="Notes" value={d.notes} />}
          </>
        )}

        {/* SSH Key fields */}
        {item.item_type === 'ssh_key' && d && (
          <>
            {d.name && <FieldRow label="Name" value={d.name} />}
            {d.publicKey && <FieldRow label="Public Key" value={d.publicKey} />}
            {d.privateKey && <FieldRow label="Private Key" value={d.privateKey} sensitive />}
            {d.passphrase && <FieldRow label="Passphrase" value={d.passphrase} sensitive />}
            {d.notes && <FieldRow label="Notes" value={d.notes} />}
          </>
        )}

        {/* Metadata */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar size={12} />
            <span>Created {formatDate(item.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <RefreshCw size={12} />
            <span>Updated {formatDate(item.updated_at)}</span>
          </div>
          {item.reprompt && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Shield size={12} />
              <span>Master password required to view</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={14} />}
          onClick={handleDelete}
          className="w-full"
        >
          Move to Trash
        </Button>
      </div>
    </div>
  );
};
