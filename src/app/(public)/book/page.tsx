// src/app/(public)/book/page.tsx
import { prisma } from '@/lib/prisma';
import { getOrgFromRequest } from '@/lib/org-from-request';
import { BookingForm } from './BookingForm';

export default async function BookPage() {
  const org = await getOrgFromRequest();

  const [sites, courtTypes, courts] = await Promise.all([
    prisma.site.findMany({
      where: { org_id: org.id, is_deleted: false },
      orderBy: { name: 'asc' },
    }),
    prisma.court_type.findMany({
      where: { org_id: org.id, is_deleted: false },
      orderBy: { name: 'asc' },
    }),
    prisma.court.findMany({
      where: { org_id: org.id, is_deleted: false },
      include: { site: true, court_type: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">
            Reservar cancha
          </h1>
          <p className="text-sm text-slate-600">
            Seleccione la sede, el tipo de cancha, la fecha y la duración para crear una reserva.
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <BookingForm sites={sites} courtTypes={courtTypes} courts={courts} />
        </section>
      </div>
    </main>
  );
}
