// lib/api.ts
import { NextRequest, NextResponse } from "next/server";

export function json(data: any, init?: number | ResponseInit) {
  const responseInit: ResponseInit | undefined = 
    typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, responseInit);
}

export function bad(msg: string, code = 400) {
  return json({ ok: false, error: msg }, { status: code });
}

export function ok(data: any) {
  return json({ ok: true, data });
}

export function toInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function parseUUID(id: string, label = "id") {
  // validación mínima
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) throw new Error(`Invalid ${label}`);
}
