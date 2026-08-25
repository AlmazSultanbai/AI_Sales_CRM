import { UserRole } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({ role }: { role: UserRole }) {
  return (
    <header className="crm-surface mx-auto mb-4 flex w-full max-w-[1700px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
          <img src="/sun-textile-logo.jpeg" alt="sun textile" className="h-full w-full object-contain object-center" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold leading-tight text-ink sm:text-lg">sun textile</h2>
          <p className="truncate text-[11px] uppercase tracking-[0.16em] text-slate-400">CRM System</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge className="hidden h-7 rounded-full bg-accent px-3 text-xs font-semibold uppercase tracking-wide text-white sm:inline-flex">
          {role}
        </Badge>
        <UserMenu />
      </div>
    </header>
  );
}
