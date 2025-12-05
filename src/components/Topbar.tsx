"use client";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function Topbar() {
  const pathname = usePathname();
  const { data } = useSession();
  const parts = pathname.split("/").filter(Boolean).slice(1); // quita "superadmin"

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* breadcrumb simple */}
        <nav className="text-sm">
          <span className="font-semibold">Super Admin</span>
          {parts.map((p, i) => (
            <span key={i} className="text-[color:hsl(var(--color-text-weak))]">
              {" "}/ {p}
            </span>
          ))}
        </nav>

        {/* user */}
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[color:hsl(var(--color-text-weak))] sm:inline">
            {data?.user?.name || data?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/superadmin/login" })}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:shadow-soft"
          >
            Cerrar Seccion
          </button>
        </div>
      </div>
    </header>
  );
}
