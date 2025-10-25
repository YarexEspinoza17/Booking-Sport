import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// solo protege endpoints de API del superadmin
export const config = {
  matcher: ["/api/superadmin/:path*"],   // 👈 nada de /superadmin páginas
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Deja pasar totalmente NextAuth
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  // Cookie de sesión correcta en dev/prod
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName,
  });

  const role = (token as any)?.role;

  if (!role || role !== "SUPER_ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}
