import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield, Star, Folder, Tag, Share2, Trash2, Settings,
  ShieldCheck, LogOut, ChevronDown, ChevronRight, Plus,
  Key, Wand2, User, ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { useSecurityStore } from '../../store/securityStore';
import toast from 'react-hot-toast';

interface SidebarProps {
  activeView: string;
  selectedFolderId?: string | null;
  onViewChange: (view: string, folderId?: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  selectedFolderId,
  onViewChange,
  isOpen,
  onClose,
}) => {
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const { user, logout } = useAuthStore();
  const { folders, createFolder } = useVaultStore();
  const { unreadCount } = useSecurityStore();
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setAddingFolder(false);
      toast.success('Folder created');
    } catch {
      toast.error('Failed to create folder');
    }
  };

  const navItemClass = (active: boolean) => `
    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer w-full text-left
    ${active
      ? 'bg-primary-600 text-white shadow-sm'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
    }
  `;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-30 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          flex flex-col transition-transform duration-200
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white">VaultPass</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => { onViewChange('all'); onClose(); }}
            className={navItemClass(activeView === 'all')}
          >
            <Key size={16} />
            <span>All Items</span>
          </button>

          <button
            onClick={() => { onViewChange('favorites'); onClose(); }}
            className={navItemClass(activeView === 'favorites')}
          >
            <Star size={16} />
            <span>Favorites</span>
          </button>

          {/* Folders */}
          <div>
            <div className="flex items-center">
              <button
                onClick={() => setFoldersExpanded(!foldersExpanded)}
                className={`${navItemClass(activeView === 'folder' || foldersExpanded)} flex-1`}
              >
                <Folder size={16} />
                <span className="flex-1">Folders</span>
                {foldersExpanded
                  ? <ChevronDown size={14} className="opacity-60" />
                  : <ChevronRight size={14} className="opacity-60" />
                }
              </button>
              <button
                onClick={() => { setAddingFolder(true); setFoldersExpanded(true); }}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 ml-1"
                title="New folder"
              >
                <Plus size={14} />
              </button>
            </div>

            {foldersExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {addingFolder && (
                  <div className="flex gap-1 items-center">
                    <input
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddFolder();
                        if (e.key === 'Escape') setAddingFolder(false);
                      }}
                      placeholder="Folder name"
                      className="flex-1 text-xs px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <button
                      onClick={handleAddFolder}
                      className="text-xs px-2 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      Add
                    </button>
                  </div>
                )}
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => { onViewChange('folder', folder.id); onClose(); }}
                    className={navItemClass(activeView === 'folder' && selectedFolderId === folder.id)}
                  >
                    <Folder size={14} className="flex-shrink-0" />
                    <span className="truncate">{folder.name || 'Unnamed'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => { onViewChange('tags'); onClose(); }}
            className={navItemClass(activeView === 'tags')}
          >
            <Tag size={16} />
            <span>Tags</span>
          </button>

          <button
            onClick={() => { onViewChange('shared'); onClose(); }}
            className={navItemClass(activeView === 'shared')}
          >
            <Share2 size={16} />
            <span>Shared</span>
          </button>

          <button
            onClick={() => { onViewChange('trash'); onClose(); }}
            className={navItemClass(activeView === 'trash')}
          >
            <Trash2 size={16} />
            <span>Trash</span>
          </button>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
            <NavLink
              to="/generator"
              className={({ isActive }) => navItemClass(isActive)}
              onClick={onClose}
            >
              <Wand2 size={16} />
              <span>Generator</span>
            </NavLink>

            {/* Security Center with unread alert badge */}
            <NavLink
              to="/security"
              className={({ isActive }) => navItemClass(isActive)}
              onClick={onClose}
            >
              <ShieldAlert size={16} />
              <span className="flex-1">Security</span>
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) => navItemClass(isActive)}
              onClick={onClose}
            >
              <Settings size={16} />
              <span>Settings</span>
            </NavLink>

            {user?.is_admin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => navItemClass(isActive)}
                onClick={onClose}
              >
                <ShieldCheck size={16} />
                <span>Admin Console</span>
              </NavLink>
            )}
          </div>
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {user?.email}
              </p>
              {user?.is_admin && (
                <p className="text-xs text-primary-600 dark:text-primary-400">Admin</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
