"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/types/domain";
import { can } from "@/lib/auth/rbac";
import { navigationItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = navigationItems.filter((item) => can(role, item.permission));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 shadow-[0_-4px_18px_rgba(15,23,42,0.10)]">
      <div
        className="mx-auto grid w-full max-w-2xl gap-0.5 px-1 sm:gap-2 sm:px-4"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-0.5 py-1.5 transition sm:px-1",
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
        })}
      </div>
    </nav>
  );
}
