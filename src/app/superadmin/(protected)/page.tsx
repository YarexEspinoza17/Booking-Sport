// src/app/superadmin/(protected)/page.tsx

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const dynamic = "force-dynamic"; // que siempre se calcule al cargar

function formatMoneyCRC(amountInt: number | null | undefined): string {
  // Si amount_int ya viene en colones (no centavos), cambia amount/100 por amount.
  const amount = amountInt ?? 0;

  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function formatDateTime(dt: Date) {
  // Por ahora formateo en UTC; luego se puede ajustar al timezone de la sede
  return format(dt, "yyyy-MM-dd HH:mm", { locale: es });
}

export default async function Dashboard() {
  const now = new Date();
  const from = subDays(now, 30);

  const [
    orgsCount,
    sitesCount,
    courtsCount,
    paymentsAgg,
    recentReservations,
  ] = await Promise.all([
    // Organizaciones activas
    prisma.org.count({
      where: {
        is_deleted: { not: true },
      },
    }),

    // Sedes activas (y de orgs activas)
    prisma.site.count({
      where: {
        is_deleted: false,
        org: {
          is_deleted: { not: true },
        },
      },
    }),

    // Canchas activas (y de orgs activas)
    prisma.court.count({
      where: {
        active: true,
        is_deleted: { not: true },
        org: {
          is_deleted: { not: true },
        },
      },
    }),

    // Ingresos últimos 30 días: pagos PAID
    prisma.payment.aggregate({
      where: {
        status: "PAID",
        created_at: {
          gte: from,
        },
        org: {
          is_deleted: { not: true },
        },
      },
      _sum: {
        amount_int: true,
      },
    }),

    // Reservas recientes confirmadas
    prisma.reservation.findMany({
      where: {
        status: "CONFIRMED",
        org: {
          is_deleted: { not: true },
        },
      },
      orderBy: {
        start_time: "desc",
      },
      take: 5,
      include: {
        org: true,
        site: true,
        court: true,
      },
    }),
  ]);

  const revenue30d = paymentsAgg._sum.amount_int ?? 0;

  const kpis = [
    { label: "Organizaciones", value: orgsCount.toString() },
    { label: "Sedes", value: sitesCount.toString() },
    { label: "Canchas", value: courtsCount.toString() },
    { label: "Ingresos (30d)", value: formatMoneyCRC(revenue30d) },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
        <p className="mt-1 text-[color:hsl(var(--color-text-weak))]">
          Resumen general.
        </p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="text-sm text-[color:hsl(var(--color-text-weak))]">
              {k.label}
            </div>
            <div className="mt-1 text-2xl font-extrabold">{k.value}</div>
          </div>
        ))}
      </section>

      {/* Reservas recientes */}
      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-bold">Reservas recientes</h2>
          <Link
            href="/superadmin/reservations"
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-muted/60 text-[color:hsl(var(--color-text-weak))]">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Org</th>
                <th className="px-4 py-2 font-medium">Sede</th>
                <th className="px-4 py-2 font-medium">Cancha</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentReservations.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-[color:hsl(var(--color-text-weak))]"
                  >
                    No hay reservas recientes.
                  </td>
                </tr>
              )}

              {recentReservations.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    {formatDateTime(r.start_time)}
                  </td>
                  <td className="px-4 py-2">{r.org?.name ?? "-"}</td>
                  <td className="px-4 py-2">{r.site?.name ?? "-"}</td>
                  <td className="px-4 py-2">{r.court?.name ?? "-"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                      Confirmada
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
