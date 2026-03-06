import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, RotateCcw, Inbox, Search } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { VaultItemCard } from '../components/vault/VaultItemCard';
import { VaultItemDetail } from '../components/vault/VaultItemDetail';
import { AddItemModal } from '../components/vault/AddItemModal';
import { Button } from '../components/ui/Button';
import { useVaultStore } from '../store/vaultStore';
import { useAuthStore } from '../store/authStore';
import { VaultItem, ItemType } from '../types';
import toast from 'react-hot-toast';

type ViewMode = 'all' | 'favorites' | 'trash' | 'folder' | 'tags' | 'shared';

export const Vault: React.FC = () => {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('theme') === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [editItem, setEditItem] = useState<VaultItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { items, fetchItems, fetchFolders, fetchTags, emptyTrash } = useVaultStore();
  const { masterKey } = useAuthStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const params: Record<string, unknown> = {};
    if (view === 'trash') params.deleted = true;
    if (view === 'favorites') params.favorite = true;
    if (view === 'folder' && selectedFolderId) params.folder_id = selectedFolderId;
    fetchItems(params);
    fetchFolders();
    fetchTags();
  }, [view, selectedFolderId]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (view === 'trash') {
      result = result.filter((i) => i.deleted_at !== null);
    } else {
      result = result.filter((i) => i.deleted_at === null);
    }

    if (view === 'favorites') result = result.filter((i) => i.favorite);
    if (view === 'folder' && selectedFolderId) result = result.filter((i) => i.folder_id === selectedFolderId);
    if (typeFilter !== 'all') result = result.filter((i) => i.item_type === typeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => {
        const d = i.decrypted;
        return (
          d?.name?.toLowerCase().includes(q) ||
          d?.username?.toLowerCase().includes(q) ||
          d?.url?.toLowerCase().includes(q) ||
          d?.email?.toLowerCase().includes(q) ||
          d?.notes?.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [items, view, selectedFolderId, typeFilter, searchQuery]);

  const handleViewChange = (newView: string, folderId?: string) => {
    setView(newView as ViewMode);
    setSelectedFolderId(folderId || null);
    setSelectedItem(null);
    setSearchQuery('');
  };

  const getViewTitle = () => {
    switch (view) {
      case 'all': return 'All Items';
      case 'favorites': return 'Favorites';
      case 'trash': return 'Trash';
      case 'folder': {
        const { folders } = useVaultStore.getState();
        const folder = folders.find((f) => f.id === selectedFolderId);
        return folder?.name || 'Folder';
      }
      default: return 'Vault';
    }
  };

  const TYPE_FILTERS: { value: ItemType | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'login', label: 'Logins' },
    { value: 'note', label: 'Notes' },
    { value: 'card', label: 'Cards' },
    { value: 'identity', label: 'Identities' },
    { value: 'ssh_key', label: 'SSH' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Sidebar
        activeView={view}
        selectedFolderId={selectedFolderId}
        onViewChange={handleViewChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddItem={() => { setEditItem(null); setAddModalOpen(true); }}
          onMenuToggle={() => setSidebarOpen(true)}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(!darkMode)}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Main list */}
          <div className={`flex-1 flex flex-col overflow-hidden ${selectedItem ? 'hidden lg:flex' : 'flex'}`}>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <h1 className="font-semibold text-gray-900 dark:text-white">{getViewTitle()}</h1>
              <span className="text-sm text-gray-400">({filteredItems.length})</span>
              <div className="ml-auto flex items-center gap-2">
                {/* Type filters */}
                <div className="hidden sm:flex gap-1">
                  {TYPE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setTypeFilter(f.value)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                        typeFilter === f.value
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {view === 'trash' && filteredItems.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={async () => {
                      if (!confirm('Empty trash? This cannot be undone.')) return;
                      await emptyTrash();
                      toast.success('Trash emptied');
                    }}
                  >
                    Empty Trash
                  </Button>
                )}
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    {searchQuery ? <Search size={28} className="text-gray-400" /> : <Inbox size={28} className="text-gray-400" />}
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {searchQuery ? 'No items match your search' : view === 'trash' ? 'Trash is empty' : 'No items yet'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {!searchQuery && view === 'all' ? 'Add your first password to get started' : ''}
                  </p>
                  {!searchQuery && view === 'all' && (
                    <Button
                      className="mt-4"
                      size="sm"
                      icon={<Plus size={14} />}
                      onClick={() => setAddModalOpen(true)}
                    >
                      Add Item
                    </Button>
                  )}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <VaultItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItem?.id === item.id}
                    onSelect={(i) => setSelectedItem(selectedItem?.id === i.id ? null : i)}
                    onEdit={(i) => { setEditItem(i); setAddModalOpen(true); }}
                    isTrash={view === 'trash'}
                  />
                ))
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selectedItem && (
            <div className="w-full lg:w-96 xl:w-[420px] flex-shrink-0 overflow-hidden">
              <VaultItemDetail
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onEdit={(item) => {
                  setEditItem(item);
                  setAddModalOpen(true);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <AddItemModal
        isOpen={addModalOpen}
        onClose={() => { setAddModalOpen(false); setEditItem(null); }}
        editItem={editItem}
      />
    </div>
  );
};
