"use client";

import { useEffect, useState } from "react";

type WeeklyRow = {
  id: string;
  dow: number;
  start_local: string; // "HH:mm"
  end_local: string;
};

type BlackoutRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export default function CourtSchedulePage({ params }: { params: { orgId: string; courtId: string } }) {
  const { orgId, courtId } = params;
  const [tab, setTab] = useState<"weekly" | "blackouts">("weekly");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Configuración de cancha</h1>
      <div className="flex gap-2">
        <button
          onClick={() => setTab("weekly")}
          className={`px-3 py-1 rounded border ${
            tab === "weekly" ? "bg-gray-900 text-white" : ""
          }`}
        >
          Horario semanal
        </button>
        <button
          onClick={() => setTab("blackouts")}
          className={`px-3 py-1 rounded border ${
            tab === "blackouts" ? "bg-gray-900 text-white" : ""
          }`}
        >
          Bloqueos
        </button>
      </div>

      {tab === "weekly" ? (
        <WeeklySchedule orgId={orgId} courtId={courtId} />
      ) : (
        <Blackouts orgId={orgId} courtId={courtId} />
      )}
    </div>
  );
}

function WeeklySchedule({ orgId, courtId }: { orgId: string; courtId: string }) {
  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [form, setForm] = useState({ dow: 1, start_local: "08:00", end_local: "17:00" });

  async function load() {
    const r = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/weekly-schedule`,
      { cache: "no-store" }
    );
    const j = await r.json();

    const data: WeeklyRow[] = (j.data ?? []).map((x: any) => ({
      id: x.id,
      dow: x.dow,
      start_local: x.start_local, // "HH:mm"
      end_local: x.end_local,     // "HH:mm"
    }));

    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const r = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/weekly-schedule`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    if (r.ok) load();
    else {
      const j = await r.json();
      alert(j.error ?? "Error");
    }
  }

  async function remove(id: string) {
    const r = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/weekly-schedule/${id}`,
      { method: "DELETE" }
    );
    if (r.ok) load();
    else alert("Error al eliminar");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium">Día</label>
          <select
            value={form.dow}
            onChange={(e) =>
              setForm((s) => ({ ...s, dow: Number(e.target.value) }))
            }
            className="border rounded px-2 py-1 w-full"
          >
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Abre</label>
          <input
            type="time"
            value={form.start_local}
            onChange={(e) =>
              setForm((s) => ({ ...s, start_local: e.target.value }))
            }
            className="border rounded px-2 py-1 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Cierra</label>
          <input
            type="time"
            value={form.end_local}
            onChange={(e) =>
              setForm((s) => ({ ...s, end_local: e.target.value }))
            }
            className="border rounded px-2 py-1 w-full"
          />
        </div>
        <div className="md:col-span-2">
          <button
            onClick={create}
            className="px-4 py-2 rounded bg-black text-white w-full"
          >
            Agregar franja
          </button>
        </div>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 border">Día</th>
            <th className="p-2 border">Abre</th>
            <th className="p-2 border">Cierra</th>
            <th className="p-2 border">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="p-2 border">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][r.dow]}
              </td>
              <td className="p-2 border">{r.start_local}</td>
              <td className="p-2 border">{r.end_local}</td>
              <td className="p-2 border">
                <button
                  onClick={() => remove(r.id)}
                  className="px-2 py-1 rounded border hover:bg-red-50"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                className="p-4 text-center text-gray-500"
                colSpan={4}
              >
                Sin franjas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Blackouts({ orgId, courtId }: { orgId: string; courtId: string }) {
  const [rows, setRows] = useState<BlackoutRow[]>([]);
  const [form, setForm] = useState({
    starts_at: "",
    ends_at: "",
    reason: "",
  });

  async function load() {
    const r = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/blackouts?per=50`,
      { cache: "no-store" }
    );
    const j = await r.json();
    setRows(j.data?.rows ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const r = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/blackouts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    if (r.ok) {
      setForm({ starts_at: "", ends_at: "", reason: "" });
      load();
    } else {
      const j = await r.json();
      alert(j.error ?? "Error");
    }
  }

  async function remove(id: string) {
    const r = await fetch(
      `/api/superadmin/orgs/${orgId}/courts/${courtId}/blackouts/${id}`,
      { method: "DELETE" }
    );
    if (r.ok) load();
    else alert("Error al eliminar");
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 grid-cols-1 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium">Inicio</label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) =>
              setForm((s) => ({ ...s, starts_at: e.target.value }))
            }
            className="border rounded px-2 py-1 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Fin</label>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) =>
              setForm((s) => ({ ...s, ends_at: e.target.value }))
            }
            className="border rounded px-2 py-1 w-full"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium">Motivo</label>
          <input
            type="text"
            value={form.reason}
            onChange={(e) =>
              setForm((s) => ({ ...s, reason: e.target.value }))
            }
            placeholder="Mantenimiento, torneo, etc."
            className="border rounded px-2 py-1 w-full"
          />
        </div>
        <div>
          <button
            onClick={create}
            className="px-4 py-2 rounded bg-black text-white w-full"
          >
            Agregar bloqueo
          </button>
        </div>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 border">Inicio</th>
            <th className="p-2 border">Fin</th>
            <th className="p-2 border">Motivo</th>
            <th className="p-2 border">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="p-2 border">
                {new Date(r.starts_at).toLocaleString()}
              </td>
              <td className="p-2 border">
                {new Date(r.ends_at).toLocaleString()}
              </td>
              <td className="p-2 border">{r.reason ?? "—"}</td>
              <td className="p-2 border">
                <button
                  onClick={() => remove(r.id)}
                  className="px-2 py-1 rounded border hover:bg-red-50"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                className="p-4 text-center text-gray-500"
                colSpan={4}
              >
                Sin bloqueos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
