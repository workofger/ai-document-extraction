import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width,
    height: height || (variant === 'text' ? '1em' : undefined),
  };

  return (
    <div
      className={`
        bg-pr-gray/50 ${variants[variant]} ${animations[animation]}
        ${className}
      `}
      style={style}
    />
  );
};

// Pre-built skeleton patterns
export const SkeletonCard: React.FC = () => (
  <div className="p-4 space-y-3">
    <Skeleton variant="rectangular" height={120} className="w-full" />
    <Skeleton variant="text" className="w-3/4" />
    <Skeleton variant="text" className="w-1/2" />
  </div>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-3/4" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonAnalysis: React.FC = () => (
  <div className="p-6 space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/3" height={20} />
        <Skeleton variant="text" className="w-1/4" />
      </div>
    </div>
    <Skeleton variant="rectangular" height={80} className="w-full" />
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center">
          <Skeleton variant="text" className="w-1/4" />
          <Skeleton variant="rectangular" height={28} className="w-1/3" />
        </div>
      ))}
    </div>
  </div>
);
