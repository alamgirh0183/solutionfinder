import type { ReactNode } from "react";
import DashboardNav from "@/components/dashboard-nav";
import { requireDashboardUser } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireDashboardUser();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 md:flex">
      <DashboardNav email={user.email ?? "Account"} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
