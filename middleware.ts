import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const host = req.headers.get("host") || url.host;
  const rootDomain = process.env.ROOT_DOMAIN || "localhost";

  let subdomain: string | null = null;
  if (host.endsWith(rootDomain)) {
    const parts = host.replace(`.${rootDomain}`, "").split(".");
    if (parts.length >= 1 && parts[0] !== rootDomain) {
      subdomain = parts[0] === "www" ? null : parts[0];
    }
  }

  const res = NextResponse.next();
  if (subdomain) res.headers.set("x-org", subdomain);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
