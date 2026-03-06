import React, { useState } from 'react';
import { Search, Plus, Wand2, Menu, Moon, Sun } from 'lucide-react';
import { Button } from '../ui/Button';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddItem: () => void;
  onMenuToggle: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onAddItem,
  onMenuToggle,
  darkMode,
  onToggleDark,
}) => {
  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 px-4 flex-shrink-0">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-lg relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search vault..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Dark mode toggle */}
        <button
          onClick={onToggleDark}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Add item */}
        <Button
          onClick={onAddItem}
          size="sm"
          icon={<Plus size={16} />}
        >
          <span className="hidden sm:inline">New Item</span>
        </Button>
      </div>
    </header>
  );
};
