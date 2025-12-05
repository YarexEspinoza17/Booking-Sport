'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Site = {
  id: string;
  name: string;
};

type CourtType = {
  id: string;
  name: string;
};

type Court = {
  id: string;
  name: string;
  site_id: string;
  court_type_id: string;
  site: { id: string; name: string };
  court_type: { id: string; name: string };
};

interface Props {
  sites: Site[];
  courtTypes: CourtType[];
  courts: Court[];
}

export function BookingForm({ sites, courtTypes, courts }: Props) {
  const router = useRouter();

  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? '');
  const [courtTypeId, setCourtTypeId] = useState<string>(courtTypes[0]?.id ?? '');
  const [courtId, setCourtId] = useState<string>('');
  const [date, setDate] = useState<string>(''); // YYYY-MM-DD
  const [startTime, setStartTime] = useState<string>('18:00'); // HH:mm
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Estado para el preview de precio/disponibilidad
  const [pricePreview, setPricePreview] = useState<{
    ok: boolean;
    priceInt?: number;
    currency?: string;
    available?: boolean;
  } | null>(null);
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null);

  // Filtrado de canchas por sede y tipo
  const filteredCourts = useMemo(
    () =>
      courts.filter(
        (c) =>
          (!siteId || c.site_id === siteId) &&
          (!courtTypeId || c.court_type_id === courtTypeId),
      ),
    [courts, siteId, courtTypeId],
  );

  // Resetear cancha si deja de aplicar
  useEffect(() => {
    if (!filteredCourts.find((c) => c.id === courtId)) {
      setCourtId(filteredCourts[0]?.id ?? '');
    }
  }, [filteredCourts, courtId]);

  // Recalcular preview de precio y disponibilidad cuando cambian datos clave
  useEffect(() => {
    async function fetchPricePreview() {
      setPricePreview(null);
      setSlotAvailable(null);
      setErrorMsg('');

      if (!siteId || !courtId || !date || !startTime || !durationMinutes) {
        return;
      }

      const startsAtDate = new Date(`${date}T${startTime}:00`);
      if (isNaN(startsAtDate.getTime())) return;

      const endsAtDate = new Date(
        startsAtDate.getTime() + durationMinutes * 60 * 1000,
      );
      if (isNaN(endsAtDate.getTime())) return;

      try {
        const res = await fetch('/api/public/price-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId,
            courtId,
            startsAt: startsAtDate.toISOString(),
            endsAt: endsAtDate.toISOString(),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          setPricePreview({ ok: false });
          setSlotAvailable(false);
          return;
        }

        setPricePreview({
          ok: true,
          priceInt: data.priceInt,
          currency: data.currency,
          available: data.available,
        });
        setSlotAvailable(data.available ?? true);
      } catch {
        setPricePreview({ ok: false });
        setSlotAvailable(null);
      }
    }

    fetchPricePreview();
  }, [siteId, courtId, date, startTime, durationMinutes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (!siteId || !courtId || !date || !startTime || !customerName.trim()) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      return;
    }

    try {
      setLoading(true);

      // Construir fechas de inicio y fin
      const startsAtDate = new Date(`${date}T${startTime}:00`);
      if (isNaN(startsAtDate.getTime())) {
        setErrorMsg('Fecha u hora inválida.');
        setLoading(false);
        return;
      }

      const endsAtDate = new Date(
        startsAtDate.getTime() + durationMinutes * 60 * 1000,
      );
      if (isNaN(endsAtDate.getTime())) {
        setErrorMsg('Fecha u hora inválida.');
        setLoading(false);
        return;
      }

      const payload = {
        siteId,
        courtId,
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate.toISOString(),
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
      };

      const res = await fetch('/api/public/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
            (res.status === 409
              ? 'El horario seleccionado ya no está disponible.'
              : 'No fue posible crear la reserva.'),
        );
      }

      const code = data.reservation?.code;
      if (code) {
        router.push(`/reservations/${code}`);
      } else {
        setErrorMsg('Reserva creada, pero no se recibió el código.');
      }
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  // Flujo: reservar y pagar ahora con Tilopay
  async function handlePayNow(e: React.MouseEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (!siteId || !courtId || !date || !startTime || !customerName.trim()) {
      setErrorMsg('Por favor complete todos los campos obligatorios.');
      return;
    }

    // Opcional: exigir que el slot esté disponible (según preview)
    if (slotAvailable === false) {
      setErrorMsg('El horario seleccionado ya no está disponible.');
      return;
    }

    try {
      setLoading(true);

      const startsAtDate = new Date(`${date}T${startTime}:00`);
      if (isNaN(startsAtDate.getTime())) {
        setErrorMsg('Fecha u hora inválida.');
        setLoading(false);
        return;
      }

      const endsAtDate = new Date(
        startsAtDate.getTime() + durationMinutes * 60 * 1000,
      );
      if (isNaN(endsAtDate.getTime())) {
        setErrorMsg('Fecha u hora inválida.');
        setLoading(false);
        return;
      }

      // 1) Crear HOLD
      const holdRes = await fetch('/api/public/reservations/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          courtId,
          startsAt: startsAtDate.toISOString(),
          endsAt: endsAtDate.toISOString(),
        }),
      });

      const holdData = await holdRes.json().catch(() => ({}));

      if (!holdRes.ok || !holdData.ok) {
        throw new Error(
          holdData.error ||
            (holdRes.status === 409
              ? 'El horario seleccionado ya no está disponible.'
              : 'No fue posible generar el bloqueo de la reserva.'),
        );
      }

      const holdId = holdData.hold?.id as string | undefined;
      if (!holdId) {
        throw new Error('No se recibió el identificador del hold.');
      }

      // 2) Iniciar pago en Tilopay (se envía también la info del cliente)
      const payRes = await fetch('/api/public/payments/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hold_id: holdId,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          // customerPhone: ... si en el futuro agrega teléfono al formulario
        }),
      });

      const payData = await payRes.json().catch(() => ({}));

      if (!payRes.ok || !payData.ok) {
        throw new Error(
          payData.error || 'No fue posible iniciar el pago con Tilopay.',
        );
      }

      const redirectUrl = payData.redirect_url as string | undefined;
      if (!redirectUrl) {
        throw new Error('Tilopay no devolvió una URL de pago.');
      }

      // 3) Redirigir a la pasarela de pago (dominio externo)
      window.location.href = redirectUrl;
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Ocurrió un error al iniciar el pago.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Sede y tipo de cancha */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Sede <span className="text-red-500">*</span>
          </label>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Tipo de cancha
          </label>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={courtTypeId}
            onChange={(e) => setCourtTypeId(e.target.value)}
          >
            <option value="">Todas</option>
            {courtTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cancha */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">
          Cancha <span className="text-red-500">*</span>
        </label>
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
        >
          {filteredCourts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.site.name} · {c.court_type.name}
            </option>
          ))}
        </select>
      </div>

      {/* Fecha, hora y duración */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Hora de inicio
          </label>
          <input
            type="time"
            step={60 * 15}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Duración (minutos)
          </label>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          >
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
            <option value={120}>120 min</option>
          </select>
        </div>
      </div>

      {/* Preview de precio y disponibilidad */}
      {pricePreview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
          {pricePreview.ok && pricePreview.priceInt != null ? (
            <>
              <span>
                Total estimado:{' '}
                <strong>
                  {pricePreview.priceInt.toLocaleString('es-CR')}{' '}
                  {pricePreview.currency === 'CRC'
                    ? '₡'
                    : pricePreview.currency === 'USD'
                    ? '$'
                    : pricePreview.currency ?? ''}
                </strong>
              </span>
              <span>
                Estado:{' '}
                {slotAvailable === false ? (
                  <span className="text-red-600 font-semibold">
                    No disponible
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">
                    Disponible
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="text-red-600">
              No se pudo obtener el precio o la disponibilidad.
            </span>
          )}
        </div>
      )}

      {/* Datos del cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Nombre del cliente <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre y apellidos"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Correo electrónico
          </label>
          <input
            type="email"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="opcional"
          />
        </div>
      </div>

      {errorMsg && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3">
        {/* Reservar sin pago online */}
        <button
          type="submit"
          disabled={loading || slotAvailable === false}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Procesando…' : 'Confirmar reserva sin pago'}
        </button>

        {/* Reservar y pagar ahora con Tilopay */}
        <button
          type="button"
          disabled={loading || slotAvailable === false}
          onClick={handlePayNow}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Redirigiendo a pago…' : 'Reservar y pagar ahora'}
        </button>
      </div>
    </form>
  );
}
