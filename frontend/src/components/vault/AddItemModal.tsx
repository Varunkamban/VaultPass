import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Wand2, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PasswordStrengthMeter } from '../ui/PasswordStrengthMeter';
import { useVaultStore } from '../../store/vaultStore';
import { VaultItem, DecryptedItem, ItemType } from '../../types';
import { toolsApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: VaultItem | null;
}

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'login', label: 'Login' },
  { value: 'note', label: 'Secure Note' },
  { value: 'card', label: 'Card' },
  { value: 'identity', label: 'Identity' },
  { value: 'ssh_key', label: 'SSH Key' },
];

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, editItem }) => {
  const { createItem, updateItem, folders } = useVaultStore();
  const [activeType, setActiveType] = useState<ItemType>(editItem?.item_type || 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingPw, setGeneratingPw] = useState(false);

  const [form, setForm] = useState<DecryptedItem & {
    folder_id?: string;
    favorite?: boolean;
    reprompt?: boolean;
  }>(
    editItem?.decrypted
      ? {
          ...editItem.decrypted,
          folder_id: editItem.folder_id || undefined,
          favorite: editItem.favorite,
          reprompt: editItem.reprompt,
        }
      : { name: '' }
  );

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const generatePassword = useCallback(async () => {
    setGeneratingPw(true);
    try {
      const res = await toolsApi.generatePassword({
        length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true,
      });
      set('password', res.data.password);
    } catch {
      toast.error('Failed to generate password');
    } finally {
      setGeneratingPw(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      const meta = {
        item_type: activeType,
        folder_id: form.folder_id,
        favorite: form.favorite,
        reprompt: form.reprompt,
      };

      const decrypted: DecryptedItem = { ...form };

      if (editItem) {
        await updateItem(editItem.id, decrypted, { ...meta, revision: editItem.revision });
        toast.success('Item updated');
      } else {
        await createItem(decrypted, meta);
        toast.success('Item saved to vault');
      }
      onClose();
    } catch {
      toast.error('Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? 'Edit Item' : 'New Vault Item'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Type selector */}
        {!editItem && (
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {ITEM_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveType(t.value)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeType === t.value
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Common: Name */}
        <Input
          label="Name *"
          value={form.name || ''}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. My Gmail Account"
          required
        />

        {/* Login fields */}
        {activeType === 'login' && (
          <>
            <Input
              label="Username / Email"
              value={form.username || ''}
              onChange={(e) => set('username', e.target.value)}
              placeholder="username@example.com"
              autoComplete="off"
            />
            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={form.password || ''}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Enter password"
                autoComplete="new-password"
                rightElement={
                  <div className="flex items-center gap-0.5 pr-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={generatePassword}
                      disabled={generatingPw}
                      className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors"
                      title="Generate password"
                    >
                      {generatingPw ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    </button>
                  </div>
                }
              />
              {form.password && (
                <div className="mt-2">
                  <PasswordStrengthMeter password={form.password} />
                </div>
              )}
            </div>
            <Input
              label="URL"
              value={form.url || ''}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </>
        )}

        {/* Card fields */}
        {activeType === 'card' && (
          <>
            <Input
              label="Cardholder Name"
              value={form.cardHolder || ''}
              onChange={(e) => set('cardHolder', e.target.value)}
              placeholder="John Doe"
            />
            <Input
              label="Card Number"
              value={form.cardNumber || ''}
              onChange={(e) => set('cardNumber', e.target.value)}
              placeholder="4111 1111 1111 1111"
              maxLength={19}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Expiry (MM/YY)"
                value={form.expiry || ''}
                onChange={(e) => set('expiry', e.target.value)}
                placeholder="12/26"
                maxLength={5}
              />
              <Input
                label="CVV"
                type="password"
                value={form.cvv || ''}
                onChange={(e) => set('cvv', e.target.value)}
                placeholder="•••"
                maxLength={4}
              />
            </div>
          </>
        )}

        {/* Identity fields */}
        {activeType === 'identity' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                value={form.firstName || ''}
                onChange={(e) => set('firstName', e.target.value)}
              />
              <Input
                label="Last Name"
                value={form.lastName || ''}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={form.email || ''}
              onChange={(e) => set('email', e.target.value)}
            />
            <Input
              label="Phone"
              value={form.phone || ''}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
              <textarea
                value={form.address || ''}
                onChange={(e) => set('address', e.target.value)}
                placeholder="123 Main St, City, Country"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </>
        )}

        {/* SSH Key fields */}
        {activeType === 'ssh_key' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Key</label>
              <textarea
                value={form.publicKey || ''}
                onChange={(e) => set('publicKey', e.target.value)}
                placeholder="ssh-rsa AAAAB3Nza..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Private Key</label>
              <textarea
                value={form.privateKey || ''}
                onChange={(e) => set('privateKey', e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
                rows={5}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-xs"
              />
            </div>
            <Input
              label="Passphrase"
              type="password"
              value={form.passphrase || ''}
              onChange={(e) => set('passphrase', e.target.value)}
            />
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {activeType === 'note' ? 'Content *' : 'Notes'}
          </label>
          <textarea
            value={form.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={activeType === 'note' ? 'Your secure note...' : 'Additional notes...'}
            rows={activeType === 'note' ? 5 : 2}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            required={activeType === 'note'}
          />
        </div>

        {/* Folder + options */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
            <select
              value={form.folder_id || ''}
              onChange={(e) => set('folder_id', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name || 'Unnamed'}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.favorite || false}
                onChange={(e) => set('favorite', e.target.checked)}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Favorite</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.reprompt || false}
                onChange={(e) => set('reprompt', e.target.checked)}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Master Password Re-prompt</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {editItem ? 'Save Changes' : 'Add to Vault'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
