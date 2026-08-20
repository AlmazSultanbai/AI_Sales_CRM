"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/types/domain";
import { can } from "@/lib/auth/rbac";
import { navigationItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = navigationItems.filter((item) => can(role, item.permission));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 shadow-soft backdrop-blur lg:hidden">
      <div
        className="mx-auto grid max-w-xl gap-1 px-1.5"
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
                "flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[11px] font-medium transition",
                active ? "bg-accent text-white" : "text-slate-600 active:bg-slate-100"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
