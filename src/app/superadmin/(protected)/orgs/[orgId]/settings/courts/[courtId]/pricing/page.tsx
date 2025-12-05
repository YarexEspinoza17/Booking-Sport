"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Currency = "CRC" | "USD";

type CourtPriceRange = {
  id: string;
  org_id: string;
  court_id: string;
  dow: number;            // 0..6
  start_local: string;    // ISO 1970-01-01T..Z
  end_local: string;      // ISO 1970-01-01T..Z
  amount_int: number;
  currency: Currency;
  created_at: string;
};

function dtToHHMM(d?: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().substring(11, 16);
}

export default function PricingPage({
  params,
}: {
  params: { orgId: string; courtId: string };
}) {
  const { orgId, courtId } = params;

  const [loading, setLoading] = useState(false);
  const [ranges, setRanges] = useState<CourtPriceRange[]>([]);

  const currencyOptions: Currency[] = ["CRC", "USD"];
  const currencySymbol = useMemo(
    () => ({
      CRC: "₡",
      USD: "$",
    }),
    []
  );

  // formulario para crear nuevo rango
  const [newRange, setNewRange] = useState<{
    dow: "" | "0" | "1" | "2" | "3" | "4" | "5" | "6";
    start_local: string;
    end_local: string;
    amount_int: string;
    currency: Currency;
  }>({
    dow: "",
    start_local: "",
    end_local: "",
    amount_int: "",
    currency: "CRC",
  });

  // edición inline
  const [editRow, setEditRow] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    dow: "" | "0" | "1" | "2" | "3" | "4" | "5" | "6";
    start_local: string;
    end_local: string;
    amount_int: string;
    currency: Currency;
  }>({
    dow: "",
    start_local: "",
    end_local: "",
    amount_int: "",
    currency: "CRC",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/superadmin/orgs/${orgId}/courts/${courtId}/price-ranges`
      );
      const j = await res.json();
      setRanges(j.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, courtId]);

  // ---- Crear rango ----
  async function createRange() {
    if (!newRange.dow) {
      alert("Seleccione un día de la semana (DOW).");
      return;
    }
    if (!newRange.start_local || !newRange.end_local) {
      alert("Inicio y Fin son obligatorios.");
      return;
    }
    if (newRange.end_local <= newRange.start_local) {
      alert("La hora de fin debe ser mayor que la hora de inicio.");
      return;
    }
    if (!newRange.amount_int) {
      alert("El precio es obligatorio.");
      return;
    }

    const payload = {
      dow: Number(newRange.dow),
      start_local: newRange.start_local,
      end_local: newRange.end_local,
      amount_int: Number(newRange.amount_int),
      currency: newRange.currency,
    };

    const res = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/price-ranges`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error(j);
      alert("No se pudo crear el rango de precio.");
      return;
    }

    setNewRange({
      dow: "",
      start_local: "",
      end_local: "",
      amount_int: "",
      currency: "CRC",
    });
    await load();
  }

  // ---- Eliminar rango ----
  async function removeRange(id: string) {
    const ok = confirm("¿Eliminar este rango de precio?");
    if (!ok) return;

    const res = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/price-ranges/${id}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      alert("No se pudo eliminar el rango.");
      return;
    }
    await load();
  }

  // ---- Editar rango (inline) ----
  function startEdit(r: CourtPriceRange) {
    setEditRow(r.id);
    setEditForm({
      dow: String(r.dow) as any,
      start_local: dtToHHMM(r.start_local),
      end_local: dtToHHMM(r.end_local),
      amount_int: String(r.amount_int),
      currency: r.currency,
    });
  }

  async function saveEdit(id: string) {
    if (!editForm.dow) {
      alert("Seleccione un día de la semana (DOW).");
      return;
    }
    if (!editForm.start_local || !editForm.end_local) {
      alert("Inicio y Fin son obligatorios.");
      return;
    }
    if (editForm.end_local <= editForm.start_local) {
      alert("La hora de fin debe ser mayor que la hora de inicio.");
      return;
    }
    if (!editForm.amount_int) {
      alert("El precio es obligatorio.");
      return;
    }

    const payload = {
      dow: Number(editForm.dow),
      start_local: editForm.start_local,
      end_local: editForm.end_local,
      amount_int: Number(editForm.amount_int),
      currency: editForm.currency,
    };

    const res = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/price-ranges/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error(j);
      alert("No se pudo actualizar el rango.");
      return;
    }
    setEditRow(null);
    await load();
  }

  const dowLabel = useMemo(
    () => ({
      0: "Dom",
      1: "Lun",
      2: "Mar",
      3: "Mié",
      4: "Jue",
      5: "Vie",
      6: "Sáb",
    }),
    []
  );

  return (
    <div className="p-6 space-y-10">
      {/* Migas */}
      <div className="text-sm text-gray-500">
        <Link
          href={`/superadmin/orgs/${orgId}/settings/courts`}
          className="underline"
        >
          ← Volver a Canchas
        </Link>
      </div>

      {/* Título */}
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">Precios por rango horario</h1>
        <p className="text-sm text-gray-600">
          Defina rangos de horas para esta cancha y el precio fijo que se cobrará en cada rango.
        </p>
      </section>

      {/* Nuevo rango */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Nuevo rango</h3>
        <div className="grid grid-cols-6 gap-2 items-end max-w-5xl">
          <div>
            <label className="text-sm block mb-1">Día (DOW)</label>
            <select
              className="border p-2 rounded w-full"
              value={newRange.dow}
              onChange={(e) =>
                setNewRange({ ...newRange, dow: e.target.value as any })
              }
            >
              <option value="">Seleccione</option>
              <option value="0">Dom</option>
              <option value="1">Lun</option>
              <option value="2">Mar</option>
              <option value="3">Mié</option>
              <option value="4">Jue</option>
              <option value="5">Vie</option>
              <option value="6">Sáb</option>
            </select>
          </div>
          <div>
            <label className="text-sm block mb-1">Inicio</label>
            <input
              type="time"
              className="border p-2 rounded w-full"
              value={newRange.start_local}
              onChange={(e) =>
                setNewRange({ ...newRange, start_local: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Fin</label>
            <input
              type="time"
              className="border p-2 rounded w-full"
              value={newRange.end_local}
              onChange={(e) =>
                setNewRange({ ...newRange, end_local: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Moneda</label>
            <select
              className="border p-2 rounded w-full"
              value={newRange.currency}
              onChange={(e) =>
                setNewRange({
                  ...newRange,
                  currency: e.target.value as Currency,
                })
              }
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm block mb-1">Precio (entero)</label>
            <input
              type="number"
              className="border p-2 rounded w-full"
              placeholder="Ej: 5000"
              value={newRange.amount_int}
              onChange={(e) =>
                setNewRange({ ...newRange, amount_int: e.target.value })
              }
            />
          </div>
          <div>
            <button
              onClick={createRange}
              className="px-4 py-2 rounded bg-black text-white w-full"
              disabled={loading}
            >
              Agregar
            </button>
          </div>
        </div>
      </section>

      {/* Lista de rangos */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Rangos configurados</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Día</th>
                <th className="p-2 text-left">Inicio</th>
                <th className="p-2 text-left">Fin</th>
                <th className="p-2 text-left">Moneda</th>
                <th className="p-2 text-left">Precio</th>
                <th className="p-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((r) => {
                const editing = editRow === r.id;

                if (!editing) {
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">
                        {dowLabel[r.dow as keyof typeof dowLabel] ?? r.dow}
                      </td>
                      <td className="p-2">{dtToHHMM(r.start_local)}</td>
                      <td className="p-2">{dtToHHMM(r.end_local)}</td>
                      <td className="p-2">{r.currency}</td>
                      <td className="p-2">
                        {currencySymbol[r.currency]}
                        {r.amount_int.toLocaleString("es-CR")}
                      </td>
                      <td className="p-2 space-x-2">
                        <button
                          onClick={() => startEdit(r)}
                          className="px-3 py-1 border rounded"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => removeRange(r.id)}
                          className="px-3 py-1 border rounded"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                }

                // fila en edición
                return (
                  <tr key={r.id} className="border-t bg-yellow-50">
                    <td className="p-2">
                      <select
                        className="border p-1 rounded"
                        value={editForm.dow}
                        onChange={(e) =>
                          setEditForm((s) => ({
                            ...s,
                            dow: e.target.value as any,
                          }))
                        }
                      >
                        <option value="">Seleccione</option>
                        <option value="0">Dom</option>
                        <option value="1">Lun</option>
                        <option value="2">Mar</option>
                        <option value="3">Mié</option>
                        <option value="4">Jue</option>
                        <option value="5">Vie</option>
                        <option value="6">Sáb</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="time"
                        className="border p-1 rounded"
                        value={editForm.start_local}
                        onChange={(e) =>
                          setEditForm((s) => ({
                            ...s,
                            start_local: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="time"
                        className="border p-1 rounded"
                        value={editForm.end_local}
                        onChange={(e) =>
                          setEditForm((s) => ({
                            ...s,
                            end_local: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="p-2">
                      <select
                        className="border p-1 rounded"
                        value={editForm.currency}
                        onChange={(e) =>
                          setEditForm((s) => ({
                            ...s,
                            currency: e.target.value as Currency,
                          }))
                        }
                      >
                        {currencyOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        className="border p-1 rounded w-24"
                        value={editForm.amount_int}
                        onChange={(e) =>
                          setEditForm((s) => ({
                            ...s,
                            amount_int: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="p-2 space-x-2">
                      <button
                        onClick={() => saveEdit(r.id)}
                        className="px-3 py-1 border rounded bg-black text-white"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditRow(null)}
                        className="px-3 py-1 border rounded"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {ranges.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={6}>
                    No hay rangos configurados para esta cancha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
