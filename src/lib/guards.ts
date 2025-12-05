// src/lib/guards.ts
import { auth } from "@/lib/auth-server";

export async function requireSuperAdmin() {
  const session = await auth(); // obtiene la sesión del request actual
  const role = (session?.user as any)?.role;

  if (role !== "SUPER_ADMIN") {
    // En route handlers (API), devuelve 401; en páginas no uses este guard (usa el cliente)
    return new Response("Unauthorized", { status: 401 });
  }
}
