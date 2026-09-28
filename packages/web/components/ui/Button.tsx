"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:pointer-events-none",
          variant === "primary" && "bg-accent text-base-950 font-bold shadow-[0_0_20px_rgba(0,245,155,.4),0_4px_10px_rgba(0,245,155,.2)] hover:-translate-y-0.5 hover:bg-accent-bright hover:shadow-[0_0_28px_rgba(0,245,155,.6)] active:translate-y-0",
          variant === "secondary" && "border border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.12] hover:border-white/30",
          variant === "ghost" && "bg-transparent text-white hover:bg-white/[0.08]",
          variant === "danger" && "bg-rose-500 text-white font-semibold shadow-[0_0_20px_rgba(244,63,94,0.35)] hover:bg-rose-400 hover:shadow-[0_0_26px_rgba(244,63,94,0.55)]",
          size === "sm" && "px-3 py-1.5 text-sm",
          size === "md" && "px-5 py-2.5 text-sm",
          size === "lg" && "px-7 py-3 text-base",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
