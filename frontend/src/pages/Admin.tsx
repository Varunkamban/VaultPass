import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Users, Shield, Key, Activity, Search,
  Lock, Ban, CheckCircle, RefreshCw, Trash2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { adminApi } from '../lib/api';
import { AdminUser, AuditLog, AccountStatus } from '../types';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'users' | 'logs';

const StatusBadge: React.FC<{ status: AccountStatus }> = ({ status }) => {
  const config: Record<AccountStatus, { color: 'green' | 'red' | 'yellow' | 'gray'; label: string }> = {
    active: { color: 'green', label: 'Active' },
    locked: { color: 'yellow', label: 'Locked' },
    suspended: { color: 'red', label: 'Suspended' },
    deleted: { color: 'gray', label: 'Deleted' },
  };
  const c = config[status];
  return <Badge color={c.color}>{c.label}</Badge>;
};

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<{
    total_users: number;
    active_users: number;
    total_vault_items: number;
    recent_logins_24h: number;
    admin_users: number;
  } | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    adminApi.getStats().then((res) => setStats(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
  }, [activeTab, userPage]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
  }, [activeTab, logPage]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await adminApi.getUsers({ page: userPage, limit: 20, search: userSearch || undefined });
      setUsers(res.data.users);
      setUserTotal(res.data.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await adminApi.getAuditLogs({ page: logPage, limit: 50, action: logSearch || undefined });
      setLogs(res.data.logs);
      setLogTotal(res.data.total);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const updateStatus = async (userId: string, status: AccountStatus) => {
    try {
      await adminApi.updateUserStatus(userId, status);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, account_status: status } : u));
      toast.success(`User ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      await adminApi.toggleAdmin(userId, isAdmin);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_admin: isAdmin } : u));
      toast.success(isAdmin ? 'Admin granted' : 'Admin revoked');
    } catch {
      toast.error('Failed to update admin status');
    }
  };

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Active Users', value: stats.active_users, icon: CheckCircle, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
    { label: 'Vault Items', value: stats.total_vault_items, icon: Key, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Logins (24h)', value: stats.recent_logins_24h, icon: Activity, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/vault" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Console</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {(['overview', 'users', 'logs'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'logs' ? 'Audit Logs' : tab}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                  <Icon size={20} />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
            {!stats && (
              <div className="col-span-4 text-center py-8 text-gray-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                Loading stats...
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                  placeholder="Search users..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <Button size="sm" variant="outline" onClick={loadUsers} icon={<RefreshCw size={14} />}>
                Refresh
              </Button>
              <p className="text-sm text-gray-500">{userTotal} users</p>
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw size={24} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Email</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Status</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">MFA</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Joined</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Last Login</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{u.email}</p>
                            {u.is_admin && <span className="text-xs text-primary-600 dark:text-primary-400">Admin</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={u.account_status} /></td>
                        <td className="px-4 py-3">
                          <Badge color={u.mfa_enabled ? 'green' : 'gray'}>{u.mfa_enabled ? 'Enabled' : 'Off'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {u.account_status === 'active' ? (
                              <>
                                <button
                                  onClick={() => updateStatus(u.id, 'locked')}
                                  className="p-1.5 rounded-md text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                                  title="Lock"
                                >
                                  <Lock size={14} />
                                </button>
                                <button
                                  onClick={() => updateStatus(u.id, 'suspended')}
                                  className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Suspend"
                                >
                                  <Ban size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => updateStatus(u.id, 'active')}
                                className="p-1.5 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                title="Activate"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => toggleAdmin(u.id, !u.is_admin)}
                              className="p-1.5 rounded-md text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                              title={u.is_admin ? 'Revoke admin' : 'Grant admin'}
                            >
                              <Shield size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                  placeholder="Filter by action..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <Button size="sm" variant="outline" onClick={loadLogs} icon={<RefreshCw size={14} />}>
                Refresh
              </Button>
              <p className="text-sm text-gray-500">{logTotal} entries</p>
            </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw size={24} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Time</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">User</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">Action</th>
                      <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">
                          {log.email || log.user_id?.slice(0, 8) || 'System'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge color={log.action.includes('DELETE') || log.action.includes('SUSPENDED') ? 'red' : log.action.includes('LOGIN') ? 'green' : 'blue'}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs font-mono">
                          {log.ip_address || '—'}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No audit logs found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
