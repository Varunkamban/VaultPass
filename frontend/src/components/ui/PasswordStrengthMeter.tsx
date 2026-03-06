import React, { useMemo } from 'react';
import zxcvbn from 'zxcvbn';

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

const strengthConfig = [
  { label: 'Very Weak', color: 'bg-red-500', textColor: 'text-red-500' },
  { label: 'Weak', color: 'bg-orange-500', textColor: 'text-orange-500' },
  { label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  { label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-500' },
  { label: 'Strong', color: 'bg-green-500', textColor: 'text-green-500' },
];

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  className = '',
}) => {
  const result = useMemo(() => {
    if (!password) return null;
    return zxcvbn(password);
  }, [password]);

  if (!password) return null;

  const score = result?.score ?? 0;
  const config = strengthConfig[score];
  const segments = 4;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Strength bars */}
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= score - 1 ? config.color : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
      {/* Label and feedback */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${config.textColor}`}>
          {config.label}
        </span>
        {result?.feedback?.suggestions?.[0] && (
          <span className="text-xs text-gray-400 dark:text-gray-500 text-right max-w-[200px] truncate">
            {result.feedback.suggestions[0]}
          </span>
        )}
      </div>
      {result?.crack_times_display?.offline_fast_hashing_1e10_per_second && score < 3 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Crack time: {result.crack_times_display.offline_fast_hashing_1e10_per_second}
        </p>
      )}
    </div>
  );
};
