import React from 'react';
import { RotateCcw, Sparkles, Zap } from 'lucide-react';
import { useDocuments } from '@/contexts/DocumentContext';
import { ProgressBar } from '@/components/ui';
import { Button } from '@/components/ui';

interface HeaderProps {
  onShowHistory?: () => void;
  onReset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset }) => {
  const { stats, resetAll } = useDocuments();

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de que deseas reiniciar todos los documentos? Esta acción no se puede deshacer.')) {
      resetAll();
      onReset?.();
    }
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;

  return (
    <header className="sticky top-0 z-50 safe-top">
      {/* Gradient border bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pr-amber/30 to-transparent" />
      
      <div className="glass-strong">
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-3 md:px-4 xl:px-6 2xl:px-8 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Logo & Title */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-shrink">
              <div className="relative flex-shrink-0">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-pr-amber/40 rounded-xl blur-lg" />
                <img 
                  src="/doc_demo/logo-icon.svg" 
                  alt="PartRunner" 
                  className="relative w-9 h-9 md:w-11 md:h-11"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm md:text-lg font-display font-bold tracking-tight flex items-center gap-1.5">
                  <span className="text-pr-white truncate">DocVal</span>
                  <span className="bg-gradient-to-r from-pr-amber to-orange-500 text-pr-charcoal text-[9px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-bold shadow-md shadow-pr-amber/20 flex-shrink-0">
                    AI
                  </span>
                </h1>
                <p className="text-[9px] md:text-xs text-pr-muted hidden sm:flex items-center gap-1 truncate">
                  <Zap size={10} className="text-pr-amber flex-shrink-0" />
                  <span className="truncate">Validación Inteligente</span>
                </p>
              </div>
            </div>

            {/* Progress & Stats */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              {/* Progress Card */}
              <div className="flex items-center gap-2 md:gap-3 bg-white/5 backdrop-blur-xl px-2 py-1.5 md:px-4 md:py-2.5 rounded-xl border border-white/5">
                {/* Progress Ring - Mobile */}
                <div className="flex md:hidden items-center gap-2">
                  <div className="relative w-8 h-8">
                    <svg className="w-8 h-8 -rotate-90">
                      <circle
                        cx="16"
                        cy="16"
                        r="13"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="3"
                        fill="none"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r="13"
                        stroke="url(#progressGradient)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${progressPercent * 0.82} 100`}
                        className="transition-all duration-500"
                      />
                      <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#F5B301" />
                          <stop offset="100%" stopColor="#22C55E" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-pr-white">
                      {progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar - Desktop */}
                <div className="hidden md:flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[9px] text-pr-muted mb-1 uppercase tracking-wider font-semibold">Progreso</p>
                    <div className="flex items-center gap-2.5">
                      <ProgressBar
                        value={stats.valid}
                        max={stats.total || 1}
                        size="sm"
                        color="accent"
                        className="w-20"
                      />
                      <span className="text-sm font-bold text-gradient tabular-nums font-display min-w-[36px]">
                        {progressPercent}%
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Stats Pills - Desktop */}
                <div className="hidden lg:flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
                  <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 bg-green-500 rounded-full shadow-sm shadow-green-500/50"></span>
                    <span className="text-xs text-green-400 font-semibold tabular-nums">{stats.valid}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 bg-red-500 rounded-full shadow-sm shadow-red-500/50"></span>
                    <span className="text-xs text-red-400 font-semibold tabular-nums">{stats.invalid}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 bg-pr-muted rounded-full"></span>
                    <span className="text-xs text-pr-muted font-semibold tabular-nums">{stats.pending}</span>
                  </div>
                </div>
              </div>

              {/* Reset Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="!p-2 md:!px-3 text-pr-muted hover:text-pr-white hover:bg-white/5 rounded-xl !min-h-[36px] !min-w-[36px]"
                title="Reiniciar todo"
              >
                <RotateCcw size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Banner */}
      {stats.total > 0 && stats.valid === stats.total && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-green-400/30 to-green-500/20 animate-gradient" />
          <div className="relative text-center py-2 px-4">
            <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-semibold text-green-400">
              <Sparkles size={14} className="animate-pulse flex-shrink-0" />
              <span className="truncate">¡Documentos validados!</span>
              <Sparkles size={14} className="animate-pulse flex-shrink-0" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
