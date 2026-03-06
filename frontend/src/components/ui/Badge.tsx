import React from 'react';

type BadgeColor = 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo';

interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const colors: Record<BadgeColor, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

export const Badge: React.FC<BadgeProps> = ({ color = 'gray', children, size = 'sm' }) => {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
        ${colors[color]}
      `}
    >
      {children}
    </span>
  );
};
