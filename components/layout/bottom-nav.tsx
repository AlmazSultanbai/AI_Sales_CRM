"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { UserRole } from "@/types/domain";
import { can } from "@/lib/auth/rbac";
import { navigationItems } from "@/components/layout/nav-items";
import { BarcodeScannerDialog } from "@/features/inventory/components/barcode-scanner-dialog";
import { cn } from "@/lib/utils";

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const [scannerOpen, setScannerOpen] = useState(false);
  const items = navigationItems.filter((item) => can(role, item.permission));

  // Кнопка сканера стоит по центру, поэтому разделы делим пополам.
  const middle = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, middle);
  const rightItems = items.slice(middle);
  const canScan = can(role, "stocks:read");

  const renderItem = (item: (typeof items)[number]) => {
    const Icon = item.icon;
    const active = pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-0.5 py-1.5 transition sm:px-1",
          active
            ? "border-accent bg-accent/5 text-accent"
            : "border-transparent text-slate-500 hover:bg-slate-50 active:bg-slate-100"
        )}
      >
        <Icon className={cn("h-6 w-6 shrink-0", active ? "text-accent" : "text-slate-500")} />
        <span
          className={cn(
            "w-full truncate text-center text-[11px] leading-none sm:text-[13px]",
            active ? "font-semibold text-accent" : "font-medium text-slate-600"
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  // Панель — обычный элемент внизу колонки, а не fixed: так она не «плавает»
  // при скролле и сворачивании адресной строки на телефоне.
  return (
    <>
      <nav className="z-40 shrink-0 border-t border-border bg-white pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 shadow-[0_-4px_18px_rgba(15,23,42,0.10)]">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-0.5 px-1 sm:gap-2 sm:px-4">
          {leftItems.map(renderItem)}

          {canScan ? (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              aria-label="Сканировать код"
              className="mx-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 transition active:scale-95 active:bg-emerald-700"
            >
              <ScanLine className="h-7 w-7" />
            </button>
          ) : null}

          {rightItems.map(renderItem)}
        </div>
      </nav>

      <BarcodeScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} />
    </>
  );
}
