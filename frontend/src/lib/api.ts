import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Request interceptor: add auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

// Response interceptor: handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorCode = (error.response.data as { error?: { code?: string } })?.error?.code;
      if (errorCode === 'TOKEN_EXPIRED') {
        if (isRefreshing) {
          return new Promise((resolve) => {
            refreshQueue.push((token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (!refreshToken) throw new Error('No refresh token');

          const response = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', newRefreshToken);

          refreshQueue.forEach((cb) => cb(accessToken));
          refreshQueue = [];

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ── Auth API ─────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; kdf_salt?: string }) =>
    api.post('/auth/register', data),
  prelogin: (email: string) =>
    api.get('/auth/prelogin', { params: { email } }),
  login: (data: { email: string; password: string; mfa_token?: string; backup_code?: string }) =>
    api.post('/auth/login', data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refresh_token: refreshToken }),
  me: () => api.get('/auth/me'),

  // MFA
  setupMfa: () => api.post('/auth/mfa/setup'),
  verifyMfa: (token: string) => api.post('/auth/mfa/verify', { token }),
  disableMfa: (password: string) => api.post('/auth/mfa/disable', { password }),

  // Backup codes
  getBackupCodesCount: () => api.get('/auth/mfa/backup-codes/count'),
  regenerateBackupCodes: (password: string) =>
    api.post('/auth/mfa/backup-codes/regenerate', { password }),

  // Password & sessions
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (sessionId: string) => api.delete(`/auth/sessions/${sessionId}`),

  // Trust IP
  trustIp: () => api.post('/auth/trust-ip'),
};

// ── Vault API ────────────────────────────────────────────────────
export const vaultApi = {
  getItems: (params?: Record<string, unknown>) => api.get('/vault/items', { params }),
  getItem: (id: string) => api.get(`/vault/items/${id}`),
  createItem: (data: unknown) => api.post('/vault/items', data),
  updateItem: (id: string, data: unknown) => api.put(`/vault/items/${id}`, data),
  deleteItem: (id: string) => api.delete(`/vault/items/${id}`),
  restoreItem: (id: string) => api.post(`/vault/items/${id}/restore`),
  permanentDelete: (id: string) => api.delete(`/vault/items/${id}/permanent`),
  emptyTrash: () => api.delete('/vault/trash'),
  toggleFavorite: (id: string) => api.post(`/vault/items/${id}/favorite`),
  syncItems: (since?: string) => api.get('/vault/sync', { params: { since } }),
  getFolders: () => api.get('/vault/folders'),
  createFolder: (data: unknown) => api.post('/vault/folders', data),
  updateFolder: (id: string, data: unknown) => api.put(`/vault/folders/${id}`, data),
  deleteFolder: (id: string) => api.delete(`/vault/folders/${id}`),
  getTags: () => api.get('/vault/tags'),
  createTag: (data: unknown) => api.post('/vault/tags', data),
  deleteTag: (id: string) => api.delete(`/vault/tags/${id}`),
};

// ── Admin API ────────────────────────────────────────────────────
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params?: Record<string, unknown>) => api.get('/admin/users', { params }),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  updateUserStatus: (id: string, status: string) =>
    api.patch(`/admin/users/${id}/status`, { status }),
  toggleAdmin: (id: string, is_admin: boolean) =>
    api.patch(`/admin/users/${id}/admin`, { is_admin }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  getAuditLogs: (params?: Record<string, unknown>) =>
    api.get('/admin/audit-logs', { params }),
};

// ── Tools API ────────────────────────────────────────────────────
export const toolsApi = {
  generatePassword: (options: unknown) => api.post('/tools/password-generate', options),
  // k-anonymity breach check: sends only first 5 chars of SHA-1 hash
  breachCheck: (hashPrefix: string) =>
    api.get('/tools/breach-check', { params: { prefix: hashPrefix } }),
};

// ── Security API ─────────────────────────────────────────────────
export const securityApi = {
  getHealth: () => api.get('/security/health'),
  getAlerts: (params?: { unread_only?: boolean; limit?: number; offset?: number }) =>
    api.get('/security/alerts', { params }),
  getUnreadCount: () => api.get('/security/alerts/unread-count'),
  markAlertRead: (id: string) => api.patch(`/security/alerts/${id}/read`),
  markAllAlertsRead: () => api.patch('/security/alerts/read-all'),
  deleteAlert: (id: string) => api.delete(`/security/alerts/${id}`),
  deleteAllAlerts: () => api.delete('/security/alerts'),
};
