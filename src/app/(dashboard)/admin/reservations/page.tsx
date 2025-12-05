// app/admin/reservations/page.tsx
import { prisma } from '@/lib/prisma';
import { getOrgFromRequest } from '@/lib/org-from-request';
import ReservationsFilters from './components/ReservationsFilters';
import ReservationsTable from './components/ReservationsTable';

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: {
    date_from?: string;
    date_to?: string;
    site_id?: string;
    court_id?: string;
    status?: string;
  };
}) {
  const req = {}; // Replace with the actual request object if available
  const org = await getOrgFromRequest(req);

  const where: any = { org_id: org.id };

  if (searchParams.site_id) where.site_id = searchParams.site_id;
  if (searchParams.court_id) where.court_id = searchParams.court_id;
  if (searchParams.status && searchParams.status !== 'ALL') {
    where.status = searchParams.status;
  }

  if (searchParams.date_from || searchParams.date_to) {
    where.start_time = {};
    if (searchParams.date_from) {
      where.start_time.gte = new Date(`${searchParams.date_from}T00:00:00.000Z`);
    }
    if (searchParams.date_to) {
      where.start_time.lte = new Date(`${searchParams.date_to}T23:59:59.999Z`);
    }
  }

  const [reservations, sites, courts] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { start_time: 'asc' },
      include: {
        court: {
          include: { site: true },
        },
        customer: true,
      },
    }),
    prisma.site.findMany({
      where: { org_id: org.id, is_deleted: false },
      orderBy: { name: 'asc' },
    }),
    prisma.court.findMany({
      where: { org_id: org.id, is_deleted: false },
      include: { site: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Encabezado */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Reservas
            </h1>
            <p className="text-sm text-slate-600">
              Filtra y revisa las reservas por sede, cancha, rango de fechas y estado.
            </p>
          </div>

          {/* Resumen rápido (opcional) */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1 shadow-sm text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{reservations.length} reservas encontradas</span>
          </div>
        </header>

        {/* Filtros */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 sm:p-4 lg:p-5">
          <ReservationsFilters
            searchParams={searchParams}
            sites={sites}
            courts={courts}
          />
        </section>

        {/* Tabla / listado */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <ReservationsTable reservations={reservations} />
        </section>
      </div>
    </main>
  );
}
