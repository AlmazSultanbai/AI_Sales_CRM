"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/domain";
import { can } from "@/lib/auth/rbac";
import { navigationItems } from "@/components/layout/nav-items";

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] flex-col border-r border-white/10 bg-sidebar p-5 text-slate-200 shadow-2xl lg:flex">
      <div className="mb-7">
        <div className="mb-3 h-[3cm] w-[3cm] overflow-hidden rounded-xl border border-white/15 bg-white/95 shadow-sm">
          <img
            src="/sun-textile-logo.jpeg"
            alt="sun textile logo"
            className="h-full w-full object-contain object-center"
          />
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">CRM System</p>
        <h1 className="mt-2 text-[31px] font-bold tracking-tight text-white">sun textile</h1>
        <p className="mt-1 text-sm text-slate-400">sun textile CRM</p>
      </div>

      <nav className="space-y-1.5">
        {navigationItems
          .filter((item) => can(role, item.permission))
          .map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition",
                  active
                    ? "bg-white/13 text-white ring-1 ring-white/20"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon className={cn("h-4 w-4 transition", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
                {item.label}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
