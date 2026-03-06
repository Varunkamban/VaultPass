import { create } from 'zustand';
import { securityApi } from '../lib/api';

export interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface HealthFactor {
  name: string;
  status: 'good' | 'warning' | 'danger';
  detail: string;
}

export interface VaultHealth {
  score: number;
  label: string;
  factors: HealthFactor[];
}

interface SecurityState {
  alerts: SecurityAlert[];
  unreadCount: number;
  health: VaultHealth | null;
  isLoading: boolean;
  isAutoLocked: boolean;
  lastActivity: number;
  autoLockTimeout: number; // minutes, 0 = disabled

  // Actions
  fetchAlerts: (unreadOnly?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  setAutoLocked: (locked: boolean) => void;
  updateLastActivity: () => void;
  setAutoLockTimeout: (minutes: number) => void;
}

const AUTO_LOCK_STORAGE_KEY = 'vaultpass_autolock_minutes';

export const useSecurityStore = create<SecurityState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  health: null,
  isLoading: false,
  isAutoLocked: false,
  lastActivity: Date.now(),
  autoLockTimeout: parseInt(localStorage.getItem(AUTO_LOCK_STORAGE_KEY) || '15', 10),

  fetchAlerts: async (unreadOnly = false) => {
    set({ isLoading: true });
    try {
      const res = await securityApi.getAlerts({ unread_only: unreadOnly, limit: 50 });
      set({ alerts: res.data.alerts, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await securityApi.getUnreadCount();
      set({ unreadCount: res.data.count });
    } catch {
      // Silently fail — badge will just not update
    }
  },

  fetchHealth: async () => {
    try {
      const res = await securityApi.getHealth();
      set({ health: res.data });
    } catch {
      // Ignore
    }
  },

  markRead: async (id: string) => {
    await securityApi.markAlertRead(id);
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, is_read: true } : a)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: async () => {
    await securityApi.markAllAlertsRead();
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, is_read: true })),
      unreadCount: 0,
    }));
  },

  deleteAlert: async (id: string) => {
    const alert = get().alerts.find((a) => a.id === id);
    await securityApi.deleteAlert(id);
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
      unreadCount: alert && !alert.is_read
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));
  },

  setAutoLocked: (locked: boolean) => {
    set({ isAutoLocked: locked });
  },

  updateLastActivity: () => {
    set({ lastActivity: Date.now() });
    // If auto-locked, unlock on activity
    if (get().isAutoLocked) {
      // AutoLock component handles the unlock UI
    }
  },

  setAutoLockTimeout: (minutes: number) => {
    localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(minutes));
    set({ autoLockTimeout: minutes });
  },
}));
