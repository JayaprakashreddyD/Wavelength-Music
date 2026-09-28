"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "min-h-10 w-full rounded-xl border border-white/[0.1] bg-white/[0.035] px-4 py-2.5 text-sm text-base-200 placeholder:text-base-400 outline-none transition-colors focus:border-accent/55 focus:bg-white/[0.05] focus:ring-2 focus:ring-accent/10",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
