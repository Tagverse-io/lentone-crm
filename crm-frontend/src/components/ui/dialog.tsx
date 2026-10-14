"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label="Close dialog" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div ref={ref} className={cn("relative max-h-[90vh] w-full overflow-y-auto rounded-lg border bg-background p-6 shadow-lg", wide ? "max-w-3xl" : "max-w-lg")}>
        <button aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogTitle({ children }: { children: ReactNode }): JSX.Element {
  return <h2 className="mb-1 text-lg font-semibold">{children}</h2>;
}

export function DialogDescription({ children }: { children: ReactNode }): JSX.Element {
  return <p className="mb-4 text-sm text-muted-foreground">{children}</p>;
}
