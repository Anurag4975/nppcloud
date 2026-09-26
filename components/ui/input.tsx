"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, trailing, ...props }, ref) => (
    <div className="relative group">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-600">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900",
          "placeholder:text-ink-400 shadow-soft",
          "transition-all duration-150 ease-in-out",
          "hover:border-ink-300",
          "focus:border-brand-500 focus:shadow-glow focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          icon && "pl-9",
          trailing && "pr-10",
          className
        )}
        {...props}
      />
      {trailing && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>
      )}
    </div>
  )
);
Input.displayName = "Input";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("mb-1.5 block text-xs font-medium text-ink-600", className)}
    {...props}
  />
));
Label.displayName = "Label";
