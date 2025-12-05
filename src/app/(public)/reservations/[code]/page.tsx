// src/app/(public)/reservations/[code]/page.tsx
import { prisma } from '@/lib/prisma';
import { getOrgFromRequest } from '@/lib/org-from-request';
import { notFound } from 'next/navigation';

type PageProps = {
  params: { code: string };
};

async function getReservation(code: string) {
  const org = await getOrgFromRequest();

  const reservation = await prisma.reservation.findFirst({
    where: {
      org_id: org.id,
      code,
    },
    include: {
      court: {
        include: {
          site: true,
          court_type: true,
        },
      },
    },
  });

  if (!reservation) {
    notFound();
  }

  return reservation;
}

export default async function ReservationVoucherPage({ params }: PageProps) {
  const reservation = await getReservation(params.code);

  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);

  const fecha = start.toLocaleDateString('es-CR', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const horaInicio = start.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const horaFin = end.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const court = reservation.court;
  const site = court.site;
  const courtType = court.court_type;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-wide text-emerald-600">
            Reserva confirmada
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Detalle de la reserva
          </h1>
          <p className="text-xs text-slate-500">
            Guarde este comprobante. Su código de reserva es{' '}
            <span className="font-mono font-semibold text-slate-900">
              {reservation.code}
            </span>
          </p>
        </header>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Código de reserva</p>
              <p className="font-mono text-lg font-semibold">
                {reservation.code}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {reservation.status === 'CONFIRMED' ? 'Confirmada' : reservation.status}
            </span>
          </div>

          <div className="h-px bg-slate-100" />

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <dt className="text-xs text-slate-500">Sede</dt>
              <dd className="font-medium text-slate-900">{site.name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-slate-500">Cancha</dt>
              <dd className="font-medium text-slate-900">
                {court.name} · {courtType.name}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-slate-500">Fecha</dt>
              <dd className="font-medium text-slate-900 capitalize">{fecha}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-slate-500">Horario</dt>
              <dd className="font-medium text-slate-900">
                {horaInicio} – {horaFin}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-slate-500">Monto</dt>
              <dd className="font-medium text-slate-900">
                ₡{reservation.price_int.toLocaleString('es-CR')}
              </dd>
            </div>
          </dl>
        </section>

        <p className="text-[11px] text-slate-500 text-center px-4">
          Presente este código al llegar a la sede para validar su reserva. Si
          necesita cambiar o cancelar la reserva, comuníquese con la recepción
          del club indicando el código mostrado arriba.
        </p>
      </div>
    </main>
  );
}
