"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  message: string;
  variant: "info" | "success" | "error";
}

const ToastContext = createContext<{ show: (message: string, variant?: Toast["variant"]) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, variant: Toast["variant"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="fixed bottom-40 left-1/2 z-[100] flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 flex-col gap-2 sm:bottom-24">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={
              "toast-enter rounded-xl px-4 py-3 text-sm shadow-lg backdrop-blur border " +
              (t.variant === "error"
                ? "border-red-500/40 bg-red-950/90 text-red-200"
                : t.variant === "success"
                ? "border-accent/40 bg-base-900/95 text-accent-bright"
                : "border-base-700 bg-base-900/95 text-base-200")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
