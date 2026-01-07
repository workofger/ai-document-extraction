import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'accent';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  color = 'accent',
  showLabel = false,
  animated = true,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const colors = {
    primary: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-orange-500',
    accent: 'bg-gradient-to-r from-pr-amber to-pr-amber-light',
  };

  return (
    <div className={`relative ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs font-medium text-pr-muted">Progreso</span>
          <span className="text-xs font-bold text-pr-white">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-pr-gray rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`
            ${sizes[size]} ${colors[color]} rounded-full
            ${animated ? 'transition-all duration-500 ease-out' : ''}
          `}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showLabel?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  color = '#F5B301',
  showLabel = true,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1F1F1F"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
          style={{
            filter: `drop-shadow(0 0 6px ${color}50)`,
          }}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-sm font-display font-bold text-pr-white">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};
