// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getSubdomainFromHost } from "./src/lib/subdomain";

export const config = {
  matcher: ["/api/superadmin/:path*"],  // 👈 se mantiene igual
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host");
  const subdomain = getSubdomainFromHost(host);

  const res = NextResponse.next();

  // Por si algún día amplías el matcher y quieres que /api/auth pase intacto
  if (pathname.startsWith("/api/auth")) {
    if (subdomain) {
      res.headers.set("x-subdomain", subdomain);
    }
    return res;
  }

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

  if (subdomain) {
    res.headers.set("x-subdomain", subdomain);
  }

  return res;
}
