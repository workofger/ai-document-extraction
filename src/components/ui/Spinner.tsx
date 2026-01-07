import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'accent';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'accent',
  className = '',
}) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };

  const colors = {
    primary: 'border-blue-500 border-t-transparent',
    white: 'border-white border-t-transparent',
    accent: 'border-pr-amber border-t-transparent',
  };

  return (
    <div
      className={`
        ${sizes[size]} ${colors[color]}
        rounded-full animate-spin
        ${className}
      `}
      role="status"
      aria-label="Cargando"
    />
  );
};

interface LoadingOverlayProps {
  message?: string;
  submessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Cargando...',
  submessage,
}) => {
  return (
    <div className="absolute inset-0 bg-pr-charcoal/90 backdrop-blur-sm flex flex-col items-center justify-center z-20">
      <Spinner size="xl" color="accent" />
      <p className="mt-4 font-display font-medium text-pr-white">{message}</p>
      {submessage && (
        <p className="mt-1 text-sm text-pr-muted">{submessage}</p>
      )}
    </div>
  );
};
