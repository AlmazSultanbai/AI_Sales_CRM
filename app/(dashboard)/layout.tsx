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

  // Каркас на всю высоту экрана: скроллится только содержимое,
  // сама страница не двигается — поэтому нижняя панель стоит намертво.
  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-6 sm:p-4 lg:p-6 xl:p-7">
        <Topbar role={role} />
        <div className="crm-page">{children}</div>
      </main>

      <BottomNav role={role} />
    </div>
  );
}
