"use client";
import { ReactNode } from "react";
import Sidebar from "../Sidebar";
import Topbar from "../Topbar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh grid grid-cols-1 lg:grid-cols-[260px_1fr] bg-muted text-[color:var(--color-text)]">
      {/* Sidebar */}
      <aside className="border-r border-border bg-card">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-dvh flex-col">
        <Topbar />
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
