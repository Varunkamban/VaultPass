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
