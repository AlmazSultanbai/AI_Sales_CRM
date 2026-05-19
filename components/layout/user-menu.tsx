"use client";

import { useState } from "react";
import { CircleUserRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function onLogout() {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-slate-50 text-slate-700"
        onClick={() => setOpen((value) => !value)}
        aria-label="Профиль"
      >
        <CircleUserRound className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-border bg-white p-2 shadow-soft">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={onLogout}
            disabled={isLoading}
          >
            <LogOut className="h-4 w-4" />
            {isLoading ? "Выход..." : "Выйти"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
