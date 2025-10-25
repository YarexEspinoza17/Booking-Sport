import { ReactNode } from "react";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import SessionProviderClient from "@/components/providers/SessionProviderClient";
import "@/app/globals.css"; // <- IMPORTANTE

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "SUPER_ADMIN") redirect("/superadmin/login");

  // 👇 El provider debe envolver AppShell porque Topbar usa useSession()
  return (
    <SessionProviderClient>
      <AppShell>{children}</AppShell>
    </SessionProviderClient>
  );
}
