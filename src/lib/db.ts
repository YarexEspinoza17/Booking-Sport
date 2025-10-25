// lib/db.ts
import { prisma } from "./prisma";

// Consulta que devuelve filas
export async function query<T = any>(sql: string, ...params: any[]): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}

// Ejecuta sin devolver filas
export async function exec(sql: string, ...params: any[]): Promise<number> {
  // $executeRawUnsafe devuelve número de filas afectadas
  // @ts-ignore
  return prisma.$executeRawUnsafe(sql, ...params);
}
