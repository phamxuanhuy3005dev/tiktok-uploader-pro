import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'tiktok';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none';

    const variants = {
      default: 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-sm',
      secondary: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700/80 border border-zinc-700/50',
      outline: 'border border-zinc-700/80 text-zinc-300 hover:bg-zinc-800/60 hover:text-white',
      ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
      destructive: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
      tiktok: 'bg-[#FE2C55] text-white hover:bg-[#E0264A] shadow-md shadow-[#FE2C55]/20 font-semibold'
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
      icon: 'h-9 w-9 p-0'
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
