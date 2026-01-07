import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-medium rounded-xl
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pr-charcoal
    disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]
  `;

  const variants = {
    primary: 'bg-pr-amber text-pr-charcoal hover:bg-pr-amber-light focus:ring-pr-amber font-semibold',
    secondary: 'bg-pr-gray text-pr-white hover:bg-pr-gray/80 focus:ring-pr-gray border border-white/10',
    accent: 'bg-pr-amber text-pr-charcoal hover:bg-pr-amber-light focus:ring-pr-amber font-semibold shadow-glow',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 focus:ring-red-500 border border-red-500/30',
    ghost: 'bg-transparent hover:bg-white/5 text-pr-muted hover:text-pr-white focus:ring-white/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
