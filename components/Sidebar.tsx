"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/shops", label: "Shops" },
  { href: "/stock", label: "Stock" },
  { href: "/movements", label: "Movements" },
  { href: "/debts", label: "Debts" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebarBorder)] h-screen flex-shrink-0 flex flex-col p-4">
      <div className="mb-8 px-4">
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">Warehouse CRM</h1>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? "bg-[var(--color-subtle)] text-[var(--color-foreground)]"
                  : "text-gray-600 hover:bg-[var(--color-subtle)] hover:text-[var(--color-foreground)] dark:text-gray-400"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
