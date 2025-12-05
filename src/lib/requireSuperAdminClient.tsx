// src/lib/requireSuperAdminClient.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession();
  const role = (data?.user as any)?.role;
  const router = useRouter();
  const pathname = usePathname();

  // evita múltiples replaces
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;

    // solo redirige si ya sabemos que NO hay sesión o rol
    if (status === "unauthenticated" || (status === "authenticated" && role !== "SUPER_ADMIN")) {
      redirectedRef.current = true;
      const next = encodeURIComponent(pathname || "/superadmin");
      router.replace(`/superadmin/login?next=${next}`);
    }
  }, [status, role, router, pathname]);

  // mientras NextAuth resuelve la sesión, no renderices nada
  if (status === "loading") return null;

  // si no tiene rol correcto, no renderices el children (ya estamos redirigiendo en useEffect)
  if (role !== "SUPER_ADMIN") return null;

  // todo ok
  return <>{children}</>;
}
