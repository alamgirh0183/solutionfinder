"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

const links = [
  { href: "/dashboard", label: "New Search", mark: "+" },
  { href: "/dashboard/history", label: "Search History", mark: "↻" },
  { href: "/dashboard/saved", label: "Saved Solutions", mark: "☆" },
  { href: "/dashboard/usage", label: "Usage & Plan", mark: "◇" },
  { href: "/dashboard/account", label: "Account", mark: "○" },
];

export default function DashboardNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white p-5 md:flex md:flex-col">
        <Link href="/" className="mb-9 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-lg font-bold tracking-tight">SolutionFinder</span>
        </Link>
        <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          Workspace
        </p>
        <nav className="space-y-1">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === link.href
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="w-5 text-center text-base">{link.mark}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-gray-100 pt-4">
          <p className="truncate px-3 text-xs text-gray-500">{email}</p>
          <form action={signOut} className="mt-2">
            <button className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <header className="border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-xs font-bold text-white">
              S
            </span>
            <span className="font-bold">SolutionFinder</span>
          </Link>
          <form action={signOut}>
            <button className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
              Sign out
            </button>
          </form>
        </div>
        <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-1">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === link.href
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${
                  active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
