'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

type Site = {
  id: string;
  name: string;
};

type Court = {
  id: string;
  name: string;
  site: {
    id: string;
    name: string;
  };
};

export default function ReservationsFilters({
  searchParams,
  sites,
  courts,
}: {
  searchParams: {
    date_from?: string;
    date_to?: string;
    site_id?: string;
    court_id?: string;
    status?: string;
  };
  sites: Site[];
  courts: Court[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [dateFrom, setDateFrom] = useState(searchParams.date_from ?? '');
  const [dateTo, setDateTo] = useState(searchParams.date_to ?? '');
  const [siteId, setSiteId] = useState(searchParams.site_id ?? '');
  const [courtId, setCourtId] = useState(searchParams.court_id ?? '');
  const [status, setStatus] = useState(searchParams.status ?? '');

  // Mantiene sincronizado el estado cuando vienen cambios desde SSR
  useEffect(() => {
    setDateFrom(searchParams.date_from ?? '');
    setDateTo(searchParams.date_to ?? '');
    setSiteId(searchParams.site_id ?? '');
    setCourtId(searchParams.court_id ?? '');
    setStatus(searchParams.status ?? '');
  }, [searchParams]);

  function applyFilters() {
    const params = new URLSearchParams(sp.toString());

    if (dateFrom) params.set('date_from', dateFrom);
    else params.delete('date_from');

    if (dateTo) params.set('date_to', dateTo);
    else params.delete('date_to');

    if (siteId) params.set('site_id', siteId);
    else params.delete('site_id');

    if (courtId) params.set('court_id', courtId);
    else params.delete('court_id');

    if (status) params.set('status', status);
    else params.delete('status');

    router.push(`/admin/reservations?${params.toString()}`);
  }

  function resetFilters() {
    setDateFrom('');
    setDateTo('');
    setSiteId('');
    setCourtId('');
    setStatus('');
    router.push(`/admin/reservations`);
  }

  return (
    <section className="border rounded-lg p-4 grid gap-3 md:grid-cols-5">
      {/* Desde */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Desde</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      {/* Hasta */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Hasta</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      {/* Sede */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Sede</label>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">Todas</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Cancha */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Cancha</label>
        <select
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">Todas</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.site.name})
            </option>
          ))}
        </select>
      </div>

      {/* Estado */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">Todos</option>
          <option value="HELD">Pendiente (Hold)</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="CANCELLED">Cancelada</option>
          <option value="EXPIRED">Expirada</option>
          <option value="CHECKED_IN">Check-in</option>
          <option value="NO_SHOW">No Show</option>
        </select>
      </div>

      {/* Buttons */}
      <div className="md:col-span-5 flex gap-2 justify-end mt-2">
        <button
          onClick={resetFilters}
          className="px-3 py-1 border rounded text-sm"
        >
          Limpiar
        </button>
        <button
          onClick={applyFilters}
          className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
        >
          Aplicar filtros
        </button>
      </div>
    </section>
  );
}
