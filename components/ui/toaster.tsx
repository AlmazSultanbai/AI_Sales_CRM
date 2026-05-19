"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error";

type ToastPayload = {
  title: string;
  description: string;
  duration?: number;
  variant?: ToastVariant;
};

type ToastItem = ToastPayload & {
  id: string;
  variant: ToastVariant;
  duration: number;
};

type ToasterContextValue = {
  toast: (payload: ToastPayload) => void;
};

const ToasterContext = createContext<ToasterContextValue | null>(null);

export function useToaster() {
  const context = useContext(ToasterContext);
  if (!context) {
    throw new Error("useToaster must be used inside ToasterProvider");
  }
  return context;
}

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, duration = 3000, variant = "success" }: ToastPayload) => {
      const id = `toast-${Date.now()}-${counterRef.current++}`;
      setToasts((current) => [...current, { id, title, description, duration, variant }]);
      window.setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto rounded-xl border bg-white p-4 shadow-soft",
              item.variant === "error" ? "border-rose-200" : "border-emerald-200"
            )}
            role="status"
            aria-live="polite"
          >
            <p className={cn("text-sm font-semibold", item.variant === "error" ? "text-rose-700" : "text-emerald-700")}>
              {item.title}
            </p>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  );
}
