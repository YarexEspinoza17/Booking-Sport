// lib/cache.ts
const mem = new Map<string, { v: any; exp: number }>();

export function cacheGet<T = any>(key: string): T | null {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) { mem.delete(key); return null; }
  return hit.v as T;
}

export function cacheSet<T = any>(key: string, value: T, ttlMs = 60_000) {
  mem.set(key, { v: value, exp: Date.now() + ttlMs });
}
