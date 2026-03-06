import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../lib/api';
import { deriveKey, generateSalt } from '../lib/crypto';

interface AuthState {
  user: User | null;
  masterKey: CryptoKey | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, mfaToken?: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
  /** Called by OAuthCallback after Microsoft SSO completes */
  loginWithSSO: (user: User, masterKey: CryptoKey) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  masterKey: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (email: string, password: string, mfaToken?: string) => {
    set({ isLoading: true });
    try {
      // Get the KDF salt for key derivation
      const preloginRes = await authApi.prelogin(email);
      const { kdf_salt, kdf_iterations } = preloginRes.data;

      // Derive the master key client-side
      const masterKey = await deriveKey(password, kdf_salt, kdf_iterations);

      // Login with credentials
      const loginRes = await authApi.login({ email, password, mfa_token: mfaToken });
      const { user, accessToken, refreshToken } = loginRes.data;

      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);

      set({ user, masterKey, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const kdf_salt = generateSalt();
      const masterKey = await deriveKey(password, kdf_salt);

      const res = await authApi.register({ email, password, kdf_salt });
      const { user, accessToken, refreshToken } = res.data;

      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);

      set({ user, masterKey, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignore logout API errors
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, masterKey: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }
    try {
      const res = await authApi.me();
      set({ user: res.data.user, isAuthenticated: true });
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false, masterKey: null });
    }
  },

  setUser: (user: User) => set({ user }),

  loginWithSSO: (user: User, masterKey: CryptoKey) => {
    set({ user, masterKey, isAuthenticated: true, isLoading: false });
  },
}));
