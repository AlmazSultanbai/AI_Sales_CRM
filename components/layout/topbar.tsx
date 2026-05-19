import { UserRole } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({ role }: { role: UserRole }) {
  return (
    <header className="crm-surface mb-4 flex items-center justify-between px-4 py-2.5 sm:px-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Company</p>
        <h2 className="text-sm font-semibold text-ink">sun textile</h2>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="hidden h-7 rounded-full bg-accent px-3 text-xs font-semibold uppercase tracking-wide text-white sm:inline-flex">{role}</Badge>
        <UserMenu />
      </div>
    </header>
  );
}
