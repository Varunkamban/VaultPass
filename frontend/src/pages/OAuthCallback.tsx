import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import { deriveKey } from '../lib/crypto';

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: 'An account with this email already exists. Please sign in with your email and password.',
  OAUTH_FAILED: 'Microsoft sign-in failed. Please try again.',
  OAUTH_INIT_FAILED: 'Could not connect to Microsoft. Please try again.',
  INVALID_STATE: 'Invalid login state. Please try again.',
  MISSING_PARAMS: 'Incomplete response from Microsoft. Please try again.',
  MISSING_CLAIMS: 'Could not read your Microsoft account information. Please try again.',
};

/**
 * Handles the OAuth2 redirect from the backend after Microsoft authentication.
 *
 * Success path:  backend redirects to /auth/callback#access_token=...
 * Error path:    backend redirects to /auth/callback?error=...
 */
const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithSSO } = useAuthStore();
  const [statusText, setStatusText] = useState('Completing sign-in…');
  // Guard against React StrictMode's double useEffect invocation in dev.
  // Without this, the first run clears window.location.hash via replaceState,
  // then the second run sees an empty hash and shows "Incomplete sign-in data".
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const handleOAuthCallback = async () => {
      // ── Error path (query param) ──────────────────────────────────────────
      const params = new URLSearchParams(window.location.search);
      const errorCode = params.get('error');
      if (errorCode) {
        const message = ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Please try again.';
        toast.error(message, { duration: 6000 });
        navigate('/login', { replace: true });
        return;
      }

      // ── Success path (URL fragment) ───────────────────────────────────────
      const fragment = new URLSearchParams(window.location.hash.slice(1)); // strip leading '#'
      const accessToken = fragment.get('access_token');
      const refreshToken = fragment.get('refresh_token');
      const ssoVaultSecret = fragment.get('sso_vault_secret');
      const kdfSalt = fragment.get('kdf_salt');
      const kdfIterations = parseInt(fragment.get('kdf_iterations') ?? '100000', 10);

      if (!accessToken || !refreshToken || !ssoVaultSecret || !kdfSalt) {
        toast.error('Incomplete sign-in data. Please try again.');
        navigate('/login', { replace: true });
        return;
      }

      // Immediately clear tokens from the URL (they're now in memory)
      window.history.replaceState({}, '', '/auth/callback');

      try {
        // Store tokens in localStorage (same as normal login)
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);

        setStatusText('Unlocking your vault…');

        // Derive the vault key from the server-managed secret
        const masterKey = await deriveKey(ssoVaultSecret, kdfSalt, kdfIterations);

        // Fetch the user profile using the new access token
        const meRes = await authApi.me();
        const user = meRes.data.user;

        // Populate the auth store — same shape as a normal login
        loginWithSSO(user, masterKey);

        toast.success(`Welcome, ${user.email}!`);
        navigate('/vault', { replace: true });
      } catch (err) {
        console.error('[OAuthCallback] error:', err);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        toast.error('Sign-in failed. Please try again.');
        navigate('/login', { replace: true });
      }
    };

    handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center px-4">
        {/* Animated shield logo */}
        <div className="relative">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <Shield className="w-10 h-10 text-white" />
          </div>
          {/* Spinner ring */}
          <div className="absolute -inset-2 rounded-2xl border-2 border-blue-400/40 border-t-blue-400 animate-spin" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">VaultPass</h1>
          <p className="text-blue-200 text-sm">{statusText}</p>
        </div>

        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
