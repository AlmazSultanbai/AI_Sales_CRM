"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

/** Компактное меню «⋯»: прячет второстепенные действия, не убирая их. */
export function ActionMenu({
  items,
  align = "right",
  ariaLabel = "Дополнительные действия",
  size = "sm",
}: {
  items: ActionMenuItem[];
  align?: "left" | "right";
  ariaLabel?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center justify-center rounded-lg border border-border bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700",
          size === "sm" ? "h-8 w-8" : "h-10 w-10"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[190px] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-soft",
            align === "right" ? "right-0" : "left-0"
          )}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={cn(
                "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition hover:bg-slate-50",
                item.danger ? "text-rose-600" : "text-slate-700"
              )}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
