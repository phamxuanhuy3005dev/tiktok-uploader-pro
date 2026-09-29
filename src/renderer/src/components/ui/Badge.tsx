import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'idle' | 'uploading' | 'queued' | 'captcha' | 'error' | 'manual';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'idle', children, ...props }) => {
  const variants = {
    idle: 'bg-zinc-800 text-zinc-400 border-zinc-700/50',
    uploading: 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse',
    queued: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    captcha: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 animate-bounce',
    error: 'bg-red-500/15 text-red-400 border-red-500/30',
    manual: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'uploading' && 'bg-rose-500 animate-ping',
          variant === 'idle' && 'bg-zinc-500',
          variant === 'queued' && 'bg-amber-500',
          variant === 'captcha' && 'bg-yellow-400',
          variant === 'error' && 'bg-red-500',
          variant === 'manual' && 'bg-cyan-400'
        )}
      />
      {children}
    </div>
  );
};
