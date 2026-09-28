"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="surface-panel w-full max-w-md rounded-2xl border border-white/[0.1] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-bold text-white">{title}</h2>
          <button aria-label="Close dialog" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-base-400 transition-colors hover:bg-white/[0.08] hover:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
