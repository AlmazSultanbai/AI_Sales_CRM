"use client";

import { usePathname } from "next/navigation";

function getTitleFromPath(path: string) {
  if (path === "/") return "Dashboard";
  const segment = path.split("/")[1];
  if (!segment) return "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Header() {
  const pathname = usePathname();
  const title = getTitleFromPath(pathname);

  return (
    <header className="h-16 flex items-center px-8 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
    </header>
  );
}
