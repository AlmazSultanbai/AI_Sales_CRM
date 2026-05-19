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
      <main className="min-h-screen flex-1 p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6 lg:pb-6 xl:p-7">
        <Topbar role={role} />
        <div className="crm-page">{children}</div>
      </main>
      <MobileNav role={role} />
    </div>
  );
}
