import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Shield, Key, Monitor, Smartphone, LogOut,
  Lock, Eye, EyeOff, Clock, RefreshCw, Copy, CheckCircle2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { useSecurityStore } from '../store/securityStore';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

type Tab = 'security' | 'sessions' | 'preferences';

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
];

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('security');
  const [darkMode, setDarkModeState] = useState(() => localStorage.getItem('theme') === 'dark');
  const { user, setUser, logout } = useAuthStore();
  const { autoLockTimeout, setAutoLockTimeout } = useSecurityStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // ── Change password ──────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setChangingPw(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      toast.success('Password changed. Please log in again.');
      setTimeout(() => logout(), 2000);
    } catch (err) {
      const error = err as AxiosError<{ error?: { message?: string } }>;
      toast.error(error.response?.data?.error?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    }
  };

  // ── MFA ───────────────────────────────────────────────────────
  const [mfaQr, setMfaQr] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [settingUpMfa, setSettingUpMfa] = useState(false);
  const [disableMfaPw, setDisableMfaPw] = useState('');
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);

  const setupMfa = async () => {
    try {
      const res = await authApi.setupMfa();
      setMfaQr(res.data.qrCode);
      setMfaSecret(res.data.secret);
      setSettingUpMfa(true);
    } catch {
      toast.error('Failed to setup MFA');
    }
  };

  const verifyMfa = async () => {
    if (mfaToken.length !== 6) { toast.error('Enter a 6-digit code'); return; }
    try {
      const res = await authApi.verifyMfa(mfaToken);
      if (res.data.backup_codes) setNewBackupCodes(res.data.backup_codes);
      toast.success('MFA enabled! Save your backup codes.');
      setSettingUpMfa(false);
      setMfaQr(''); setMfaSecret(''); setMfaToken('');
      if (user) setUser({ ...user, mfa_enabled: true });
    } catch {
      toast.error('Invalid MFA code. Try again.');
    }
  };

  const disableMfa = async () => {
    if (!disableMfaPw) { toast.error('Enter your password'); return; }
    setDisablingMfa(true);
    try {
      await authApi.disableMfa(disableMfaPw);
      toast.success('MFA disabled');
      if (user) setUser({ ...user, mfa_enabled: false });
      setDisableMfaPw('');
    } catch {
      toast.error('Invalid password');
    } finally {
      setDisablingMfa(false);
    }
  };

  // ── Backup codes ─────────────────────────────────────────────
  const [backupCodesCount, setBackupCodesCount] = useState<number | null>(null);
  const [regenPw, setRegenPw] = useState('');
  const [regenPwShow, setRegenPwShow] = useState(false);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [regenCodes, setRegenCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (user?.mfa_enabled) {
      authApi.getBackupCodesCount()
        .then((res) => setBackupCodesCount(res.data.count))
        .catch(() => {});
    }
  }, [user?.mfa_enabled]);

  const handleRegenBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenPw) return;
    setRegeneratingCodes(true);
    try {
      const res = await authApi.regenerateBackupCodes(regenPw);
      setRegenCodes(res.data.backup_codes);
      setBackupCodesCount(res.data.backup_codes.length);
      setRegenPw('');
      toast.success('Backup codes regenerated');
    } catch (err) {
      const error = err as AxiosError<{ error?: { message?: string } }>;
      toast.error(error.response?.data?.error?.message || 'Failed to regenerate codes');
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    toast.success('All codes copied to clipboard');
  };

  // ── Sessions ─────────────────────────────────────────────────
  const [sessions, setSessions] = useState<{
    id: string; device_info: Record<string, unknown>; created_at: string; expires_at: string
  }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (activeTab === 'sessions') {
      setLoadingSessions(true);
      authApi.getSessions()
        .then((res) => setSessions(res.data.sessions))
        .finally(() => setLoadingSessions(false));
    }
  }, [activeTab]);

  const revokeSession = async (id: string) => {
    try {
      await authApi.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Session revoked');
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'security', label: 'Security', icon: Key },
    { key: 'sessions', label: 'Sessions', icon: Monitor },
    { key: 'preferences', label: 'Preferences', icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/vault" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <div className="flex gap-6">
          {/* Tab nav */}
          <div className="w-40 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === key
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {/* ── Security Tab ──────────────────────────────── */}
            {activeTab === 'security' && (
              <>
                {/* Change password */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Change Master Password</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">All sessions will be revoked after changing.</p>
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <Input label="Current Password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
                    <Input label="New Password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      required
                      error={confirmPw && newPw !== confirmPw ? 'Passwords do not match' : undefined}
                    />
                    <Button type="submit" size="sm" loading={changingPw}>Update Password</Button>
                  </form>
                </div>

                {/* MFA */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h2>
                    {user?.mfa_enabled && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full">Enabled</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Protect your account with a TOTP authenticator app.</p>

                  {!user?.mfa_enabled ? (
                    settingUpMfa ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Scan with your authenticator (Google Authenticator, Authy, etc.):</p>
                        <img src={mfaQr} alt="QR Code" className="w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
                        {mfaSecret && (
                          <p className="text-xs text-gray-500 font-mono break-all bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                            {mfaSecret}
                          </p>
                        )}
                        <div className="flex gap-3">
                          <Input
                            label="Verification Code"
                            value={mfaToken}
                            onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            maxLength={6}
                          />
                          <Button onClick={verifyMfa} className="mt-6 self-start" size="sm">Verify</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" icon={<Smartphone size={14} />} onClick={setupMfa}>Enable MFA</Button>
                    )
                  ) : (
                    <div className="space-y-3">
                      <Input
                        label="Confirm with master password to disable MFA"
                        type="password"
                        value={disableMfaPw}
                        onChange={(e) => setDisableMfaPw(e.target.value)}
                        placeholder="Enter master password"
                      />
                      <Button variant="danger" size="sm" loading={disablingMfa} onClick={disableMfa}>Disable MFA</Button>
                    </div>
                  )}

                  {newBackupCodes.length > 0 && (
                    <BackupCodesDisplay
                      codes={newBackupCodes}
                      title="Save Your Backup Codes"
                      description="Each code can only be used once. Store them in a safe place outside this device."
                      onCopyAll={() => copyAllCodes(newBackupCodes)}
                      onCopyCode={copyCode}
                      copiedCode={copiedCode}
                      onDismiss={() => setNewBackupCodes([])}
                    />
                  )}
                </div>

                {/* Backup codes regeneration (only when MFA enabled and no new codes shown) */}
                {user?.mfa_enabled && newBackupCodes.length === 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Key size={15} className="text-gray-500" />
                      <h2 className="font-semibold text-gray-900 dark:text-white">Backup Codes</h2>
                      {backupCodesCount !== null && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          backupCodesCount >= 4
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : backupCodesCount > 0
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        }`}>
                          {backupCodesCount} remaining
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Regenerate codes if they're running low or have been compromised. Old codes become invalid.
                    </p>
                    <form onSubmit={handleRegenBackupCodes} className="space-y-3">
                      <div className="relative">
                        <Input
                          label="Confirm with master password"
                          type={regenPwShow ? 'text' : 'password'}
                          value={regenPw}
                          onChange={(e) => setRegenPw(e.target.value)}
                          placeholder="Enter master password"
                        />
                        <button
                          type="button"
                          onClick={() => setRegenPwShow((s) => !s)}
                          className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {regenPwShow ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <Button type="submit" size="sm" variant="outline" loading={regeneratingCodes} icon={<RefreshCw size={13} />}>
                        Regenerate Backup Codes
                      </Button>
                    </form>

                    {regenCodes.length > 0 && (
                      <BackupCodesDisplay
                        codes={regenCodes}
                        title="New Backup Codes"
                        description="Old codes are now invalid. Save these somewhere safe."
                        onCopyAll={() => copyAllCodes(regenCodes)}
                        onCopyCode={copyCode}
                        copiedCode={copiedCode}
                        onDismiss={() => setRegenCodes([])}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Sessions Tab ─────────────────────────────── */}
            {activeTab === 'sessions' && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Active Sessions</h2>
                {loadingSessions ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-gray-500">No active sessions.</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {(s.device_info as { userAgent?: string })?.userAgent?.substring(0, 50) || 'Unknown device'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Created: {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="xs"
                          icon={<LogOut size={12} />}
                          onClick={() => revokeSession(s.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Preferences Tab ──────────────────────────── */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                {/* Appearance */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Dark Mode</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Toggle between light and dark theme</p>
                    </div>
                    <div
                      onClick={() => setDarkModeState(!darkMode)}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${darkMode ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* Auto-lock */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={15} className="text-gray-500" />
                    <h2 className="font-semibold text-gray-900 dark:text-white">Auto-Lock</h2>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Automatically lock your vault after a period of inactivity.
                  </p>
                  <div className="flex items-center gap-3">
                    <Clock size={15} className="text-gray-400 flex-shrink-0" />
                    <select
                      value={autoLockTimeout}
                      onChange={(e) => setAutoLockTimeout(parseInt(e.target.value, 10))}
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {AUTO_LOCK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {autoLockTimeout === 0 && (
                    <p className="mt-2 text-xs text-amber-500 flex items-center gap-1">
                      <Shield size={11} />
                      Auto-lock is disabled. Enable it for better security.
                    </p>
                  )}
                </div>

                {/* Account info */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Account</h2>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p><span className="font-medium text-gray-900 dark:text-gray-200">Email:</span> {user?.email}</p>
                    {user?.is_admin && (
                      <p><span className="font-medium text-gray-900 dark:text-gray-200">Role:</span> Administrator</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Backup codes display ─────────────────────────────────────────
const BackupCodesDisplay: React.FC<{
  codes: string[];
  title: string;
  description: string;
  onCopyAll: () => void;
  onCopyCode: (code: string) => void;
  copiedCode: string | null;
  onDismiss: () => void;
}> = ({ codes, title, description, onCopyAll, onCopyCode, copiedCode, onDismiss }) => (
  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">{title}</h3>
      <button
        onClick={onCopyAll}
        className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
      >
        <Copy size={11} /> Copy all
      </button>
    </div>
    <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">{description}</p>
    <div className="grid grid-cols-2 gap-2 mb-3">
      {codes.map((code) => (
        <button
          key={code}
          onClick={() => onCopyCode(code)}
          className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700/30
                     rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
        >
          {code}
          {copiedCode === code
            ? <CheckCircle2 size={13} className="text-green-500 ml-2 flex-shrink-0" />
            : <Copy size={13} className="text-gray-400 ml-2 flex-shrink-0" />
          }
        </button>
      ))}
    </div>
    <button
      onClick={onDismiss}
      className="text-xs text-amber-600 dark:text-amber-500 hover:underline"
    >
      I've saved my codes — dismiss
    </button>
  </div>
);
