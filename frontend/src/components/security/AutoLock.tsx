import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { useSecurityStore } from '../../store/securityStore';
import { useAuthStore } from '../../store/authStore';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

const AutoLock: React.FC = () => {
  const { isAutoLocked, lastActivity, autoLockTimeout, setAutoLocked, updateLastActivity } = useSecurityStore();
  const { logout } = useAuthStore();
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track user activity
  const handleActivity = useCallback(() => {
    if (!isAutoLocked) {
      updateLastActivity();
    }
  }, [isAutoLocked, updateLastActivity]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [handleActivity]);

  // Auto-lock timer
  useEffect(() => {
    if (autoLockTimeout === 0) return; // Disabled

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivity;
      const idleMinutes = idleMs / 60000;

      // Show countdown warning at 1 minute before lock
      const timeoutMs = autoLockTimeout * 60000;
      const remainingMs = timeoutMs - idleMs;

      if (remainingMs <= 60000 && remainingMs > 0 && !isAutoLocked) {
        setCountdown(Math.ceil(remainingMs / 1000));
      } else {
        setCountdown(null);
      }

      if (idleMinutes >= autoLockTimeout && !isAutoLocked) {
        setAutoLocked(true);
        setCountdown(null);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lastActivity, autoLockTimeout, isAutoLocked, setAutoLocked]);

  // Countdown display timer
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => (c !== null && c > 1 ? c - 1 : null));
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    setIsUnlocking(true);
    setError('');

    try {
      const { user, login } = useAuthStore.getState();
      if (!user?.email) throw new Error('No user session');

      // Re-derive key by re-logging in (validates master password)
      await login(user.email, masterPassword);
      setAutoLocked(false);
      setMasterPassword('');
      updateLastActivity();
    } catch {
      setError('Incorrect master password. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLogout = async () => {
    setAutoLocked(false);
    await logout();
  };

  // Show warning countdown
  if (countdown !== null && !isAutoLocked) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-amber-500 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 animate-fade-in">
        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">Locking in {countdown}s</p>
          <p className="text-xs opacity-80">Move your mouse to stay unlocked</p>
        </div>
      </div>
    );
  }

  // Auto-lock overlay
  if (!isAutoLocked) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-sm mx-4">
        {/* Lock icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-violet-400" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Vault Locked</h2>
          <p className="text-gray-400 text-sm">
            Your vault was locked due to inactivity.
            <br />
            Enter your master password to continue.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Master password"
              autoFocus
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                         text-center text-lg tracking-widest"
            />
            {error && (
              <p className="mt-2 text-sm text-red-400 text-center">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!masterPassword || isUnlocking}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed
                       text-white font-semibold rounded-xl transition-colors"
          >
            {isUnlocking ? 'Unlocking…' : 'Unlock Vault'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoLock;
