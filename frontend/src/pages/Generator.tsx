import React, { useState, useCallback, useEffect } from 'react';
import { Copy, RefreshCw, Check, Shield, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter';
import { toolsApi } from '../lib/api';
import toast from 'react-hot-toast';

interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export const Generator: React.FC = () => {
  const [darkMode] = useState(
    () => localStorage.getItem('theme') === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const [options, setOptions] = useState<GeneratorOptions>({
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [password, setPassword] = useState('');
  const [strengthLabel, setStrengthLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await toolsApi.generatePassword(options);
      const { password: pw, strength_label } = res.data;
      setPassword(pw);
      setStrengthLabel(strength_label);
      setHistory((prev) => [pw, ...prev.slice(0, 9)]);
    } catch {
      toast.error('Failed to generate password');
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    generate();
  }, []);

  const copyPassword = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    toast.success('Copied! Clears in 30s');
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {});
      setCopied(false);
    }, 30000);
  };

  const set = (field: keyof GeneratorOptions, value: boolean | number) =>
    setOptions((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/vault"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Password Generator</h1>
          </div>
        </div>

        {/* Generated password display */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-4">
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 mb-4">
            <code className="flex-1 text-lg font-mono text-gray-900 dark:text-gray-100 break-all tracking-wider">
              {password || '---'}
            </code>
            <div className="flex items-center gap-2">
              <button
                onClick={generate}
                disabled={loading}
                className="p-2 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                title="Regenerate"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={copyPassword}
                className="p-2 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                title="Copy"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          {password && <PasswordStrengthMeter password={password} />}
          {strengthLabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Server rating: {strengthLabel}</p>
          )}
        </div>

        {/* Options */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Options</h2>

          {/* Length slider */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">Length</label>
              <span className="text-sm font-mono font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded">
                {options.length}
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={128}
              value={options.length}
              onChange={(e) => set('length', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>4</span>
              <span>128</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'uppercase' as keyof GeneratorOptions, label: 'Uppercase (A-Z)' },
              { key: 'lowercase' as keyof GeneratorOptions, label: 'Lowercase (a-z)' },
              { key: 'numbers' as keyof GeneratorOptions, label: 'Numbers (0-9)' },
              { key: 'symbols' as keyof GeneratorOptions, label: 'Symbols (!@#$)' },
              { key: 'excludeAmbiguous' as keyof GeneratorOptions, label: 'Exclude Ambiguous' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => set(key, !options[key])}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                    options[key] ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      options[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button className="w-full" size="lg" onClick={generate} loading={loading} icon={<RefreshCw size={16} />}>
          Generate New Password
        </Button>

        {/* History */}
        {history.length > 1 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mt-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Recent ({history.length - 1})
            </h2>
            <div className="space-y-2">
              {history.slice(1).map((pw, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <code className="flex-1 text-sm font-mono text-gray-600 dark:text-gray-400 truncate">
                    {pw}
                  </code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(pw);
                      toast.success('Copied!');
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-500 transition-all"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
