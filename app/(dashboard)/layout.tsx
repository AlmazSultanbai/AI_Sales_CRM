import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserRole } from "@/types/domain";
import { headers } from "next/headers";

function resolveRole(value: string | null): UserRole {
  return value === "user" ? "user" : "admin";
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const role = resolveRole(headerList.get("x-user-role"));

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <Sidebar role={role} />
      <main className="min-h-screen w-full min-w-0 flex-1 p-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:p-6 lg:pb-6 xl:p-7">
        <Topbar role={role} />
        <div className="crm-page">{children}</div>
      </main>
      <MobileNav role={role} />
    </div>
  );
}
