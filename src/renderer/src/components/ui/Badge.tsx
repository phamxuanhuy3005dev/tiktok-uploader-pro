import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 
    | 'idle' 
    | 'uploading' 
    | 'queued' 
    | 'captcha' 
    | 'error' 
    | 'manual'
    | 'success'
    | 'outline'
    | 'secondary'
    | 'info'
    | 'destructive';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'idle', children, ...props }) => {
  const variants = {
    idle: 'bg-slate-100 text-slate-600 border-slate-200',
    uploading: 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse',
    queued: 'bg-amber-50 text-amber-700 border-amber-200',
    captcha: 'bg-orange-50 text-orange-700 border-orange-200 animate-bounce',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    manual: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    outline: 'bg-transparent text-slate-600 border-slate-200',
    secondary: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    destructive: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors shrink-0',
        variants[variant],
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          variant === 'uploading' && 'bg-sky-500 animate-ping',
          variant === 'idle' && 'bg-slate-400',
          variant === 'queued' && 'bg-amber-500',
          variant === 'captcha' && 'bg-orange-500',
          variant === 'error' && 'bg-rose-500',
          variant === 'manual' && 'bg-indigo-500',
          variant === 'success' && 'bg-emerald-500',
          variant === 'outline' && 'bg-slate-400',
          variant === 'secondary' && 'bg-slate-400',
          variant === 'info' && 'bg-sky-500',
          variant === 'destructive' && 'bg-rose-500'
        )}
      />
      {children}
    </div>
  );
};
