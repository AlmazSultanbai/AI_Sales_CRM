import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { UserRole } from "@/types/domain";
import { headers } from "next/headers";

function resolveRole(value: string | null): UserRole {
  return value === "user" ? "user" : "admin";
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const role = resolveRole(headerList.get("x-user-role"));

  return (
    <div className="min-h-screen bg-bg">
      <main className="min-h-screen w-full min-w-0 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:p-6 lg:pb-[calc(6rem+env(safe-area-inset-bottom))] xl:p-7 xl:pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Topbar role={role} />
        <div className="crm-page">{children}</div>
      </main>
      <BottomNav role={role} />
    </div>
  );
}
