'use client';

import { useState } from 'react';

export default function CancelButton({ code }: { code: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirm('¿Seguro que desea cancelar la reserva?')) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/public/reservations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setResult(`Error: ${json.error ?? 'No fue posible cancelar.'}`);
      } else {
        setResult('Reserva cancelada correctamente. Recargue la página para ver el nuevo estado.');
      }
    } catch {
      setResult('Error inesperado al cancelar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60"
      >
        {loading ? 'Cancelando...' : 'Cancelar reserva'}
      </button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
