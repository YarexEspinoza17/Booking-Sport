// src/lib/subdomain.ts

export function getMainDomain(): string {
    const d = process.env.NEXT_PUBLIC_MAIN_DOMAIN;
    if (!d) {
      throw new Error("NEXT_PUBLIC_MAIN_DOMAIN no está definido en el .env");
    }
    return d;
  }
  
  export function normalizeHost(host: string | null): string | null {
    if (!host) return null;
    const [hostname] = host.split(":");
    return hostname.toLowerCase();
  }
  
  /**
   * Obtiene el subdominio a partir del host.
   *
   * Ejemplos:
   *  host = "accrom.localhost"             => "accrom"
   *  host = "accrom.booking-sport.com"     => "accrom"
   *  host = "booking-sport.com"            => null
   *  host = "localhost"                    => null
   */
  export function getSubdomainFromHost(host: string | null): string | null {
    const hostname = normalizeHost(host);
    if (!hostname) return null;
  
    const mainDomain = getMainDomain();
    const [mainHostname] = mainDomain.split(":");
  
    // Caso prod: accrom.booking-sport.com
    if (hostname === mainHostname) return null;
  
    if (hostname.endsWith("." + mainHostname)) {
      const sub = hostname.replace("." + mainHostname, "");
      return sub || null;
    }
  
    // Caso local: accrom.localhost con NEXT_PUBLIC_MAIN_DOMAIN=localhost:3000
    if (hostname.endsWith(".localhost") && mainHostname.startsWith("localhost")) {
      const sub = hostname.replace(".localhost", "");
      return sub || null;
    }
  
    return null;
  }
  