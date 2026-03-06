import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Vault } from './pages/Vault';
import { Generator } from './pages/Generator';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import Security from './pages/Security';
import AutoLock from './components/security/AutoLock';
import { useAuthStore } from './store/authStore';
import { useVaultStore } from './store/vaultStore';
import { useSecurityStore } from './store/securityStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Admin-only route
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_admin) return <Navigate to="/vault" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loadUser, masterKey } = useAuthStore();
  const { setMasterKey } = useVaultStore();
  const { fetchUnreadCount } = useSecurityStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadUser();
    }
    // Apply stored theme
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (masterKey) setMasterKey(masterKey);
  }, [masterKey]);

  // Poll security alert count every 2 minutes when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUnreadCount]);

  return (
    <>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/vault" replace /> : <Login />
        } />
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/vault" replace /> : <Register />
        } />
        <Route path="/vault" element={
          <ProtectedRoute><Vault /></ProtectedRoute>
        } />
        <Route path="/generator" element={
          <ProtectedRoute><Generator /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><Settings /></ProtectedRoute>
        } />
        <Route path="/security" element={
          <ProtectedRoute><Security /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute><Admin /></AdminRoute>
        } />
        <Route path="/" element={<Navigate to="/vault" replace />} />
        <Route path="*" element={<Navigate to="/vault" replace />} />
      </Routes>

      {/* AutoLock overlay — only active when authenticated */}
      {isAuthenticated && <AutoLock />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--toast-bg, #1e293b)',
              color: 'var(--toast-color, #f1f5f9)',
              border: '1px solid var(--toast-border, #334155)',
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
