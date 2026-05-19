"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/types/domain";
import { can } from "@/lib/auth/rbac";
import { navigationItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-soft backdrop-blur lg:hidden">
      <div className="grid grid-cols-6 gap-1">
        {navigationItems
          .filter((item) => can(role, item.permission))
          .map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-medium transition",
                  active ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
