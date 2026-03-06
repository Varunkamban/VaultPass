import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const { setMasterKey } = useVaultStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password, mfaRequired ? mfaToken : undefined);
      const { masterKey } = useAuthStore.getState();
      if (masterKey) setMasterKey(masterKey);
      toast.success('Welcome back!');
      navigate('/vault');
    } catch (err) {
      const error = err as AxiosError<{ error?: { code?: string; message?: string }; mfa_required?: boolean }>;
      if (error.response?.data?.mfa_required) {
        setMfaRequired(true);
        toast('Enter your 6-digit authenticator code');
      } else {
        const message = error.response?.data?.error?.message || 'Invalid credentials';
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-primary-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl shadow-lg mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">VaultPass</h1>
          <p className="text-gray-400 mt-1.5">Your secure password manager</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {mfaRequired ? 'Two-Factor Verification' : 'Sign in to your vault'}
          </h2>

          {/* Microsoft SSO button — only shown on the main login step */}
          {!mfaRequired && (
            <>
              <a
                href="/api/v1/auth/oauth/microsoft"
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {/* Official Microsoft "four-squares" logo */}
                <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
                  <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Sign in with Microsoft
              </a>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs text-gray-400 bg-white dark:bg-gray-900">
                    or continue with email
                  </span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!mfaRequired ? (
              <>
                <Input
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />

                <Input
                  label="Master Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your master password"
                  autoComplete="current-password"
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-3 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </>
            ) : (
              <Input
                label="Authenticator Code"
                type="text"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                helperText="Enter the 6-digit code from your authenticator app"
              />
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={isLoading}
            >
              {mfaRequired ? 'Verify' : 'Unlock Vault'}
            </Button>
          </form>

          {mfaRequired && (
            <button
              onClick={() => setMfaRequired(false)}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Back to login
            </button>
          )}

          {!mfaRequired && (
            <p className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Create one
              </Link>
            </p>
          )}
        </div>

        <p className="text-center mt-4 text-xs text-gray-600">
          Your master password never leaves your device.
        </p>
      </div>
    </div>
  );
};
