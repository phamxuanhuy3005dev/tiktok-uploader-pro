import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    "default" | "secondary" | "outline" | "ghost" | "destructive" | "tiktok";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none select-none cursor-pointer";

    const variants = {
      default:
        "bg-sky-500 text-white hover:bg-sky-600 shadow-sm shadow-sky-500/20",
      secondary:
        "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80",
      outline:
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm",
      ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
      destructive:
        "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100",
      tiktok:
        "bg-sky-600 text-white hover:bg-sky-700 shadow-sm shadow-sky-600/25 font-semibold",
    };

    const sizes = {
      sm: "text-xs px-2.5 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5",
      icon: "h-8 w-8 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
