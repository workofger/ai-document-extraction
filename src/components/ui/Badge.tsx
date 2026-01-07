import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'amber';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
  dot = false,
}) => {
  const variants = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    neutral: 'bg-white/10 text-pr-muted border-white/10',
    amber: 'bg-pr-amber/20 text-pr-amber border-pr-amber/30',
  };

  const dotColors = {
    success: 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]',
    error: 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
    warning: 'bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.5)]',
    info: 'bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.5)]',
    neutral: 'bg-pr-muted',
    amber: 'bg-pr-amber shadow-[0_0_6px_rgba(245,179,1,0.5)]',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold border
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
};
