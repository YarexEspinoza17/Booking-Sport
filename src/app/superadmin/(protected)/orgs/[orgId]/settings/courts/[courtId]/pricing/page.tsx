"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Currency = "CRC" | "USD";

type BasePrice = {
  id: string;
  org_id: string;
  court_id: string;
  currency: Currency;
  amount_int: number;
  created_at: string;
} | null;

type PriceRule = {
  id: string;
  org_id: string;
  court_id: string;
  dow: number | null;
  start_local: string | null; // ISO 1970-01-01T..Z desde la API
  end_local: string | null;
  multiplier: number | null;
  add_int: number | null;
  created_at: string;
};

function dtToHHMM(d?: string | null) {
  if (!d) return "";
  // Prisma devuelve Date serializada ISO; recortamos HH:mm
  return new Date(d).toISOString().substring(11, 16);
}

function hhmmToIso1970(hhmm: string | undefined) {
  if (!hhmm) return null;
  return new Date(`1970-01-01T${hhmm}:00.000Z`).toISOString();
}

export default function PricingPage({
  params,
}: {
  params: { orgId: string; courtId: string };
}) {
  const { orgId, courtId } = params;

  const [loading, setLoading] = useState(false);
  const [base, setBase] = useState<BasePrice>(null);
  const [rules, setRules] = useState<PriceRule[]>([]);

  const [bpForm, setBpForm] = useState<{ currency: Currency; amount_int: number }>({
    currency: "CRC",
    amount_int: 0,
  });

  const [newRule, setNewRule] = useState<{
    dow: "" | "0" | "1" | "2" | "3" | "4" | "5" | "6";
    start_local: string; // HH:mm
    end_local: string;   // HH:mm
    multiplier: string;  // usar string para inputs (luego convertir)
    add_int: string;
  }>({
    dow: "",
    start_local: "",
    end_local: "",
    multiplier: "",
    add_int: "",
  });

  const [editRow, setEditRow] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    dow: "" | "0" | "1" | "2" | "3" | "4" | "5" | "6";
    start_local: string;
    end_local: string;
    multiplier: string;
    add_int: string;
  }>({
    dow: "",
    start_local: "",
    end_local: "",
    multiplier: "",
    add_int: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [bpRes, rRes] = await Promise.all([
        fetch(`/api/superadmin/orgs/${orgId}/courts/${courtId}/base-price`),
        fetch(`/api/superadmin/orgs/${orgId}/courts/${courtId}/price-rules`),
      ]);

      const bpJ = await bpRes.json();
      const rJ = await rRes.json();

      setBase(bpJ.data ?? null);
      if (bpJ.data) {
        setBpForm({
          currency: bpJ.data.currency,
          amount_int: bpJ.data.amount_int,
        });
      }

      setRules(rJ.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, courtId]);

  // ---- Base Price ----
  async function saveBase() {
    const res = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/base-price`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bpForm),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error(j);
      alert("No se pudo guardar el precio base.");
      return;
    }
    await load();
  }

  // ---- Crear Regla ----
  async function createRule() {
    if ((newRule.start_local && !newRule.end_local) || (!newRule.start_local && newRule.end_local)) {
      alert("Inicio y Fin deben venir juntos o ambos vacíos.");
      return;
    }
    if (newRule.start_local && newRule.end_local && newRule.end_local <= newRule.start_local) {
      alert("Fin debe ser mayor que Inicio.");
      return;
    }
    const payload: any = {
      dow: newRule.dow === "" ? null : Number(newRule.dow),
      start_local: newRule.start_local || null,
      end_local: newRule.end_local || null,
      multiplier: newRule.multiplier === "" ? undefined : Number(newRule.multiplier),
      add_int: newRule.add_int === "" ? undefined : Number(newRule.add_int),
    };

    const res = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/price-rules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error(j);
      alert("No se pudo crear la regla.");
      return;
    }
    setNewRule({ dow: "", start_local: "", end_local: "", multiplier: "", add_int: "" });
    await load();
  }

  // ---- Eliminar Regla ----
  async function removeRule(id: string) {
    const ok = confirm("¿Eliminar esta regla?");
    if (!ok) return;
    const res = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/price-rules/${id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      alert("No se pudo eliminar.");
      return;
    }
    await load();
  }

  // ---- Editar Regla (inline) ----
  function startEdit(r: PriceRule) {
    setEditRow(r.id);
    setEditForm({
      dow: r.dow === null || r.dow === undefined ? "" : String(r.dow) as any,
      start_local: dtToHHMM(r.start_local),
      end_local: dtToHHMM(r.end_local),
      multiplier: r.multiplier === null || r.multiplier === undefined ? "" : String(r.multiplier),
      add_int: r.add_int === null || r.add_int === undefined ? "" : String(r.add_int),
    });
  }

  async function saveEdit(id: string) {
    if ((editForm.start_local && !editForm.end_local) || (!editForm.start_local && editForm.end_local)) {
      alert("Inicio y Fin deben venir juntos o ambos vacíos.");
      return;
    }
    if (editForm.start_local && editForm.end_local && editForm.end_local <= editForm.start_local) {
      alert("Fin debe ser mayor que Inicio.");
      return;
    }
    const payload: any = {
      dow: editForm.dow === "" ? null : Number(editForm.dow),
      start_local: editForm.start_local || null,
      end_local: editForm.end_local || null,
      multiplier: editForm.multiplier === "" ? undefined : Number(editForm.multiplier),
      add_int: editForm.add_int === "" ? undefined : Number(editForm.add_int),
    };

    const res = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/price-rules/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.error(j);
      alert("No se pudo actualizar.");
      return;
    }
    setEditRow(null);
    await load();
  }

  const currencyOptions = useMemo<Currency[]>(() => ["CRC", "USD"], []);

  return (
    <div className="p-6 space-y-10">
      {/* Migas (opcional) */}
      <div className="text-sm text-gray-500">
        <Link href={`/superadmin/orgs/${orgId}/settings/courts`} className="underline">
          ← Volver a Canchas
        </Link>
      </div>

      {/* Precio Base */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Precio base</h2>
        <div className="flex gap-2 items-end">
          <select
            value={bpForm.currency}
            onChange={(e) =>
              setBpForm((s) => ({ ...s, currency: e.target.value as Currency }))
            }
            className="border p-2 rounded"
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="border p-2 rounded"
            value={bpForm.amount_int}
            onChange={(e) => setBpForm((s) => ({ ...s, amount_int: Number(e.target.value) }))}
            placeholder="Monto (entero)"
          />
          <button
            onClick={saveBase}
            className="px-4 py-2 rounded bg-black text-white"
            disabled={loading}
          >
            Guardar
          </button>
        </div>
      </section>

      {/* Nueva Regla */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Nueva regla</h3>
        <div className="grid grid-cols-6 gap-2 items-end max-w-4xl">
          <div>
            <label className="text-sm block mb-1">DOW</label>
            <select
              className="border p-2 rounded w-full"
              value={newRule.dow}
              onChange={(e) => setNewRule({ ...newRule, dow: e.target.value as any })}
            >
              <option value="">—</option>
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
              value={newRule.start_local}
              onChange={(e) => setNewRule({ ...newRule, start_local: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Fin</label>
            <input
              type="time"
              className="border p-2 rounded w-full"
              value={newRule.end_local}
              onChange={(e) => setNewRule({ ...newRule, end_local: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Multiplier</label>
            <input
              type="number"
              step="0.01"
              className="border p-2 rounded w-full"
              placeholder="1.00"
              value={newRule.multiplier}
              onChange={(e) => setNewRule({ ...newRule, multiplier: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Add Int</label>
            <input
              type="number"
              className="border p-2 rounded w-full"
              placeholder="0"
              value={newRule.add_int}
              onChange={(e) => setNewRule({ ...newRule, add_int: e.target.value })}
            />
          </div>
          <div>
            <button
              onClick={createRule}
              className="px-4 py-2 rounded bg-black text-white w-full"
              disabled={loading}
            >
              Agregar
            </button>
          </div>
        </div>
      </section>

      {/* Lista de reglas */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Reglas</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
          <thead className="bg-gray-100">
  <tr>
    <th className="p-2 text-left">DOW</th>
    <th className="p-2 text-left">Inicio</th>
    <th className="p-2 text-left">Fin</th>
    <th className="p-2 text-left">Multiplier</th>
    <th className="p-2 text-left">Add Int</th>
    <th className="p-2 text-left">Descripción</th>
    <th className="p-2 text-left">Acciones</th>
  </tr>
</thead>

<tbody>
  {rules.map((r) => {
    const editing = editRow === r.id;
    const desc = (() => {
      const m = r.multiplier ?? 1;
      const a = r.add_int ?? 0;
      const perc = ((m - 1) * 100).toFixed(0);
      let parts: string[] = [];
      if (m !== 1) {
        parts.push(`${Number(perc) > 0 ? "+" : ""}${perc}%`);
      }
      if (a !== 0) {
        parts.push(`${a > 0 ? "+" : ""}₡${a.toLocaleString()}`);
      }
      if (parts.length === 0) return "Sin efecto";
      return parts.join(" ");
    })();

    if (!editing) {
      return (
        <tr key={r.id} className="border-t hover:bg-gray-50">
          <td className="p-2">{r.dow ?? "—"}</td>
          <td className="p-2">{dtToHHMM(r.start_local) || "—"}</td>
          <td className="p-2">{dtToHHMM(r.end_local) || "—"}</td>
          <td className="p-2">{r.multiplier ?? "—"}</td>
          <td className="p-2">{r.add_int ?? "—"}</td>
          <td className="p-2 text-gray-700 italic">{desc}</td>
          <td className="p-2 space-x-2">
            <button
              onClick={() => startEdit(r)}
              className="px-3 py-1 border rounded"
            >
              Editar
            </button>
            <button
              onClick={() => removeRule(r.id)}
              className="px-3 py-1 border rounded"
            >
              Eliminar
            </button>
          </td>
        </tr>
      );
    }

    // fila en edición (no cambia)
    return (
      <tr key={r.id} className="border-t bg-yellow-50">
        <td className="p-2">
          <select
            className="border p-1 rounded"
            value={editForm.dow}
            onChange={(e) =>
              setEditForm((s) => ({ ...s, dow: e.target.value as any }))
            }
          >
            <option value="">—</option>
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
              setEditForm((s) => ({ ...s, start_local: e.target.value }))
            }
          />
        </td>
        <td className="p-2">
          <input
            type="time"
            className="border p-1 rounded"
            value={editForm.end_local}
            onChange={(e) =>
              setEditForm((s) => ({ ...s, end_local: e.target.value }))
            }
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            step="0.01"
            className="border p-1 rounded w-24"
            value={editForm.multiplier}
            onChange={(e) =>
              setEditForm((s) => ({ ...s, multiplier: e.target.value }))
            }
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            className="border p-1 rounded w-24"
            value={editForm.add_int}
            onChange={(e) =>
              setEditForm((s) => ({ ...s, add_int: e.target.value }))
            }
          />
        </td>
        <td className="p-2 italic text-gray-500">—</td>
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
  {rules.length === 0 && (
    <tr>
      <td className="p-4 text-gray-500" colSpan={7}>
        No hay reglas configuradas.
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
