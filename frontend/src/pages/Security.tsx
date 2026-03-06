import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, ShieldX, Bell, BellOff,
  CheckCircle2, AlertTriangle, XCircle, Trash2, RefreshCw,
  Eye, EyeOff, Lock, Wifi, Key
} from 'lucide-react';
import { useSecurityStore, SecurityAlert } from '../store/securityStore';
import { toolsApi, authApi } from '../lib/api';
import { sha1 } from '../lib/crypto';

// ── Health Score Ring ────────────────────────────────────────────
const HealthScoreRing: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#10b981' :  // green
    score >= 60 ? '#f59e0b' :  // amber
    score >= 40 ? '#f97316' :  // orange
    '#ef4444';                 // red

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} stroke="#1f2937" strokeWidth="12" fill="none" />
        <circle
          cx="70" cy="70" r={radius}
          stroke={color} strokeWidth="12" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold text-white">{score}</div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  );
};

// ── Severity badge ───────────────────────────────────────────────
const SeverityBadge: React.FC<{ severity: SecurityAlert['severity'] }> = ({ severity }) => {
  const map = {
    low: 'bg-blue-500/10 text-blue-400',
    medium: 'bg-amber-500/10 text-amber-400',
    high: 'bg-orange-500/10 text-orange-400',
    critical: 'bg-red-500/10 text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[severity]}`}>
      {severity}
    </span>
  );
};

// ── Factor row ───────────────────────────────────────────────────
const FactorRow: React.FC<{
  name: string; detail: string; status: 'good' | 'warning' | 'danger'
}> = ({ name, detail, status }) => {
  const Icon = status === 'good' ? CheckCircle2 : status === 'warning' ? AlertTriangle : XCircle;
  const colors = {
    good: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colors[status]}`} />
      <div>
        <p className="text-sm font-medium text-gray-200">{name}</p>
        <p className="text-xs text-gray-500">{detail}</p>
      </div>
    </div>
  );
};

// ── Main Security Page ───────────────────────────────────────────
const Security: React.FC = () => {
  const { health, alerts, isLoading, fetchHealth, fetchAlerts, markRead, markAllRead, deleteAlert } = useSecurityStore();

  // Breach check state
  const [breachPassword, setBreachPassword] = useState('');
  const [breachShow, setBreachShow] = useState(false);
  const [breachResult, setBreachResult] = useState<{ count: number; checked: boolean } | null>(null);
  const [breachLoading, setBreachLoading] = useState(false);
  const [breachError, setBreachError] = useState('');

  // Trust IP state
  const [trustingIp, setTrustingIp] = useState(false);
  const [trustSuccess, setTrustSuccess] = useState(false);

  useEffect(() => {
    fetchHealth();
    fetchAlerts();
  }, [fetchHealth, fetchAlerts]);

  // ── Breach check ─────────────────────────────────────────────
  const handleBreachCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breachPassword) return;

    setBreachLoading(true);
    setBreachError('');
    setBreachResult(null);

    try {
      const fullHash = await sha1(breachPassword);
      const prefix = fullHash.slice(0, 5);
      const suffix = fullHash.slice(5);

      const res = await toolsApi.breachCheck(prefix);
      const lines: string[] = res.data.hashes.split('\n');

      let found = 0;
      for (const line of lines) {
        const [lineSuffix, countStr] = line.trim().split(':');
        if (lineSuffix === suffix) {
          found = parseInt(countStr, 10);
          break;
        }
      }
      setBreachResult({ count: found, checked: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setBreachError(msg || 'Breach check failed. Try again later.');
    } finally {
      setBreachLoading(false);
    }
  };

  // ── Trust IP ─────────────────────────────────────────────────
  const handleTrustIp = async () => {
    setTrustingIp(true);
    try {
      await authApi.trustIp();
      setTrustSuccess(true);
      setTimeout(() => setTrustSuccess(false), 3000);
    } catch {
      // Ignore
    } finally {
      setTrustingIp(false);
    }
  };

  const unreadAlerts = alerts.filter((a) => !a.is_read);
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');

  return (
    <div className="flex-1 overflow-auto bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-violet-400" />
            Security Center
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Monitor your vault health, security alerts, and protect your account.
          </p>
        </div>

        {/* Top row: Health Score + Critical Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health Score */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Vault Health Score</h2>
            <div className="flex items-center gap-6">
              {health ? (
                <>
                  <HealthScoreRing score={health.score} label={health.label} />
                  <div className="flex-1 space-y-0">
                    {health.factors.map((f) => (
                      <FactorRow key={f.name} name={f.name} detail={f.detail} status={f.status} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center w-full py-8">
                  <RefreshCw className="w-6 h-6 text-gray-600 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            {/* Breach Check */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Password Breach Check
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Check if a password appears in known data breaches.
                Uses k-anonymity — your password is never sent.
              </p>
              <form onSubmit={handleBreachCheck} className="space-y-3">
                <div className="relative">
                  <input
                    type={breachShow ? 'text' : 'password'}
                    value={breachPassword}
                    onChange={(e) => { setBreachPassword(e.target.value); setBreachResult(null); }}
                    placeholder="Enter password to check"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white
                               placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setBreachShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {breachShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!breachPassword || breachLoading}
                  className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {breachLoading ? 'Checking…' : 'Check Password'}
                </button>
              </form>

              {breachError && (
                <p className="mt-2 text-xs text-red-400">{breachError}</p>
              )}
              {breachResult?.checked && (
                <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2
                  ${breachResult.count === 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {breachResult.count === 0 ? (
                    <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Password not found in any known breaches.</>
                  ) : (
                    <><XCircle className="w-4 h-4 flex-shrink-0" />
                      Found <strong>{breachResult.count.toLocaleString()}</strong> time(s) in breaches. Change this password immediately!
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Trust Current IP */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                Trusted IP
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Trust your current IP address to suppress suspicious login alerts when accessing from this location.
              </p>
              <button
                onClick={handleTrustIp}
                disabled={trustingIp || trustSuccess}
                className={`w-full py-2 text-sm font-medium rounded-lg transition-colors
                  ${trustSuccess
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'}`}
              >
                {trustSuccess ? '✓ IP Trusted' : trustingIp ? 'Trusting…' : 'Trust Current IP'}
              </button>
            </div>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800">
          <div className="flex items-center justify-between p-5 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-violet-400" />
              <h2 className="font-semibold text-white">Security Alerts</h2>
              {unreadAlerts.length > 0 && (
                <span className="px-2 py-0.5 bg-violet-600/20 text-violet-400 text-xs font-medium rounded-full">
                  {unreadAlerts.length} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadAlerts.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <BellOff className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button
                onClick={() => fetchAlerts()}
                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                title="Refresh alerts"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-800">
            {alerts.length === 0 ? (
              <div className="py-12 text-center">
                <ShieldCheck className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No security alerts — your account looks great!</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onRead={() => markRead(alert.id)}
                  onDelete={() => deleteAlert(alert.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Critical Alerts Summary (if any) */}
        {criticalAlerts.filter(a => !a.is_read).length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <ShieldX className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">
                {criticalAlerts.filter(a => !a.is_read).length} critical alert(s) require your attention
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Review and address the alerts above to improve your security score.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Alert Row ────────────────────────────────────────────────────
const AlertRow: React.FC<{
  alert: SecurityAlert;
  onRead: () => void;
  onDelete: () => void;
}> = ({ alert, onRead, onDelete }) => {
  const SeverityIcon = {
    low: CheckCircle2,
    medium: AlertTriangle,
    high: ShieldAlert,
    critical: ShieldX,
  }[alert.severity];

  const iconColor = {
    low: 'text-blue-400',
    medium: 'text-amber-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  }[alert.severity];

  const typeIcon = {
    SUSPICIOUS_LOGIN: Wifi,
    ACCOUNT_LOCKED: Lock,
    BACKUP_CODE_USED: Key,
    BACKUP_CODES_LOW: Key,
    BACKUP_CODES_REGENERATED: Key,
    PASSWORD_CHANGED: Lock,
  }[alert.alert_type] ?? ShieldAlert;

  const TypeIcon = typeIcon;

  return (
    <div className={`flex items-start gap-4 px-5 py-4 transition-colors ${!alert.is_read ? 'bg-violet-600/5' : ''}`}>
      <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
        <SeverityIcon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <TypeIcon className="w-3.5 h-3.5 text-gray-500" />
          <p className={`text-sm font-medium ${!alert.is_read ? 'text-white' : 'text-gray-300'}`}>
            {alert.title}
          </p>
          <SeverityBadge severity={alert.severity} />
          {!alert.is_read && (
            <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{alert.message}</p>
        <p className="text-xs text-gray-600 mt-1">
          {new Date(alert.created_at).toLocaleString()}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!alert.is_read && (
          <button
            onClick={onRead}
            className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors"
            title="Mark as read"
          >
            <BellOff className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
          title="Delete alert"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Security;
