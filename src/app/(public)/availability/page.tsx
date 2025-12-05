// app/public/availability/page.tsx
"use client";
import { useState } from "react";

export default function AvailabilityPage() {
  const [siteId, setSiteId] = useState("");
  const [courtTypeId, setCourtTypeId] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState(60);
  const [tz, setTz] = useState("America/Costa_Rica");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      site_id: siteId,
      date,
      duration_min: String(duration),
    });
    if (courtTypeId) params.set("court_type_id", courtTypeId);
    if (tz) params.set("tz", tz);

    const res = await fetch(`/api/public/availability?${params.toString()}`, { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Disponibilidad pública</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <input className="border p-2 rounded" placeholder="site_id" value={siteId} onChange={e=>setSiteId(e.target.value)} />
        <input className="border p-2 rounded" placeholder="court_type_id (opcional)" value={courtTypeId} onChange={e=>setCourtTypeId(e.target.value)} />
        <input className="border p-2 rounded" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <input className="border p-2 rounded" type="number" min={5} step={5} value={duration} onChange={e=>setDuration(+e.target.value)} />
        <input className="border p-2 rounded" placeholder="tz" value={tz} onChange={e=>setTz(e.target.value)} />
      </div>
      <button onClick={fetchData} disabled={loading} className="px-4 py-2 rounded bg-black text-white">
        {loading ? "Consultando…" : "Consultar"}
      </button>

      {data?.ok && (
        <div className="space-y-6">
          {data.courts.map((c: any) => (
            <div key={c.court_id} className="border rounded p-3">
              <div className="font-medium">{c.court_name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.slots.length === 0 && <span className="text-sm text-neutral-500">Sin espacios</span>}
                {c.slots.map((s: any, i: number) => (
                  <span key={i} className="text-sm border rounded px-2 py-1">
                    {new Date(s.start).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                    {" - "}
                    {new Date(s.end).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {data && !data.ok && (
        <div className="text-red-600 text-sm">Error: {data.error}</div>
      )}
    </div>
  );
}
