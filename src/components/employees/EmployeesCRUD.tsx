// =============================================
// Archivo: src/components/employees/EmployeesCRUD.tsx
// Descripción: UI completo para CRUD de empleados + asignación a sedes.
// - Lista con búsqueda, filtro por sede y paginación
// - Crear empleado (con asignación inicial opcional a sedes)
// - Editar empleado (nombre y rol)
// - Eliminar (soft-delete) y Restaurar
// - Asignar/Revocar sedes
// Parámetros: orgId (uuid) y apiBase ("/api/superadmin" o "/api/orgs")
// Requisitos: Tailwind
// =============================================
"use client";

import { useEffect, useMemo, useState } from "react";

/* ========== Tipos ========== */
export type Site = { id: string; name: string };
export type EmployeeRow = {
  id: string;
  org_id?: string;
  email: string;
  full_name: string | null;
  role: "OWNER" | "SITE_ADMIN" | "STAFF" | "SUPER_ADMIN";
  created_at: string;
  is_deleted?: boolean;
  sites: Site[];
};

type EmployeesListResp = {
  ok: boolean;
  data: EmployeeRow[];
  meta: { page: number; per: number; total: number };
  error?: string;
};

type SimpleOk = { ok: boolean; data?: any; error?: string };

type Props = {
  orgId: string;
  apiBase?: "/api/superadmin" | "/api/orgs";
  canCreate?: boolean;
};

/* ========== Componente principal ========== */
export default function EmployeesCRUD({ orgId, apiBase = "/api/superadmin" }: Props) {
  // filtros
  const [q, setQ] = useState("");
  const [siteIdFilter, setSiteIdFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(10);

  // datos
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sedes
  const [sites, setSites] = useState<Site[]>([]);

  // toasts simples
  const [toast, setToast] = useState("");
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  // modales
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  // estados de formularios
  const [busy, setBusy] = useState(false);

  // crear
  const [cEmail, setCEmail] = useState("");
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState<"OWNER" | "SITE_ADMIN" | "STAFF">("STAFF");
  const [cSiteIds, setCSiteIds] = useState<string[]>([]);

  // editar
  const [eId, setEId] = useState<string>("");
  const [eEmail, setEEmail] = useState<string>("");
  const [eName, setEName] = useState<string>("");
  const [eRole, setERole] = useState<"OWNER" | "SITE_ADMIN" | "STAFF">("STAFF");

  // asignar
  const [aId, setAId] = useState<string>("");
  const [aEmail, setAEmail] = useState<string>("");
  const [aSiteId, setASiteId] = useState<string>("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / per)), [total, per]);

  /* ======= Fetchers ======= */
  async function fetchSites() {
    try {
      const res = await fetch(`${apiBase}/orgs/${orgId}/sites?page=1&per=500`, { cache: "no-store" });
      const json = await res.json();
  
      // Normalización MUY tolerante al shape
      let raw: any =
        Array.isArray(json) ? json :
        json?.data?.items ??
        json?.data?.rows ??
        json?.data?.data ??
        json?.data ??
        json?.rows ??
        json?.items ??
        json?.sites ??
        [];
  
      if (!Array.isArray(raw)) raw = [];
  
      const cleaned = raw.map((x: any) => ({
        id: String(x.id ?? x.site_id),
        name: String(x.name ?? x.site_name ?? "Sede"),
      }));
  
      setSites(cleaned);
    } catch {
      setSites([]);
    }
  }
  

  async function fetchEmployees() {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per: String(per) });
      if (q) params.set("q", q);
      if (siteIdFilter) params.set("site_id", siteIdFilter);
      const res = await fetch(`${apiBase}/orgs/${orgId}/employees?` + params.toString());
      const json: EmployeesListResp = await res.json();
      if (!json.ok) throw new Error(json.error || "Error listando empleados");
      setRows(json.data); setTotal(json.meta.total);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  useEffect(() => { fetchSites(); }, [orgId, apiBase]);
  useEffect(() => { fetchEmployees(); }, [orgId, apiBase, q, siteIdFilter, page, per]);

  const resetAndReload = () => { setPage(1); fetchEmployees(); };

  /* ======= Crear ======= */
  const toggleSiteCreate = (id: string) => setCSiteIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  async function onCreate() {
    if (!cEmail) return alert("Email requerido");
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/orgs/${orgId}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cEmail.trim(), full_name: cName.trim() || undefined, role: cRole, site_ids: cSiteIds.length ? cSiteIds : undefined })
      });
      const json: SimpleOk = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo crear");
      setCreateOpen(false); showToast("Colaborador creado");
      setCEmail(""); setCName(""); setCRole("STAFF"); setCSiteIds([]);
      resetAndReload();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  /* ======= Editar ======= */
  function openEdit(row: EmployeeRow) {
    setEId(row.id); setEEmail(row.email); setEName(row.full_name ?? "");
    const r = row.role === "SUPER_ADMIN" ? "STAFF" : (row.role as any);
    setERole(r);
    setEditOpen(true);
  }

  async function onEdit() {
    if (!eId) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/orgs/${orgId}/employees/${eId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: eName.trim() || null, role: eRole })
      });
      const json: SimpleOk = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo editar");
      setEditOpen(false); showToast("Colaborador actualizado");
      resetAndReload();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  /* ======= Eliminar/Restaurar ======= */
  async function onDelete(id: string) {
    if (!confirm("¿Eliminar colaborador?")) return;
    try {
      const res = await fetch(`${apiBase}/orgs/${orgId}/employees/${id}`, { method: "DELETE" });
      const json: SimpleOk = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo eliminar");
      showToast("Colaborador eliminado");
      resetAndReload();
    } catch (e: any) { alert(e.message); }
  }

  async function onRestore(id: string) {
    try {
      const res = await fetch(`${apiBase}/orgs/${orgId}/employees/${id}/restore`, { method: "POST" });
      const json: SimpleOk = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo restaurar");
      showToast("Colaborador restaurado");
      resetAndReload();
    } catch (e: any) { alert(e.message); }
  }

  /* ======= Asignar/Revocar sede ======= */
  function openAssign(row: EmployeeRow) { setAId(row.id); setAEmail(row.email); setASiteId(""); setAssignOpen(true); }

  async function confirmAssign() {
    if (!aId || !aSiteId) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/orgs/${orgId}/sites/${aSiteId}/employees/${aId}`, { method: "POST" });
      const json: SimpleOk = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo asignar");
      setAssignOpen(false); showToast("Asignado a sede");
      resetAndReload();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  async function revoke(employeeId: string, siteId: string) {
    if (!confirm("¿Revocar acceso a la sede?")) return;
    try {
      const res = await fetch(`${apiBase}/orgs/${orgId}/sites/${siteId}/employees/${employeeId}`, { method: "DELETE" });
      const json: SimpleOk = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo revocar");
      showToast("Acceso revocado");
      resetAndReload();
    } catch (e: any) { alert(e.message); }
  }

  /* ======= Render ======= */
  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded bg-black text-white text-sm px-4 py-2 shadow">{toast}</div>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm text-slate-600 mb-1">Buscar por nombre o email</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. ana@club.com" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-slate-300" />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Filtrar por sede</label>
          <select value={siteIdFilter} onChange={(e) => setSiteIdFilter(e.target.value)} className="px-3 py-2 border rounded min-w-[220px]">
            <option value="">Todas</option>
            {(sites ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Registros/pág.</label>
          <select value={per} onChange={(e) => setPer(Number(e.target.value))} className="px-3 py-2 border rounded">
            {[10, 20, 50, 100].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setCreateOpen(true)} className="h-10 px-4 rounded bg-emerald-600 text-white">Nuevo colaborador</button>
          <button onClick={() => { setPage(1); fetchEmployees(); }} className="h-10 px-4 rounded bg-slate-900 text-white">Aplicar</button>
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Nombre</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Rol</th>
              <th className="text-left px-4 py-2">Sedes</th>
              <th className="text-right px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>)}
            {!loading && rows.length === 0 && (<tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Sin resultados</td></tr>)}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.full_name || "—"}</td>
                <td className="px-4 py-2">{r.email}</td>
                <td className="px-4 py-2"><span className="inline-flex items-center rounded px-2 py-0.5 text-xs border bg-white">{r.role}</span></td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    {(r.sites ?? []).map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-2 border rounded px-2 py-1 bg-slate-50">
                        {s.name}
                        <button onClick={() => revoke(r.id, s.id)} className="text-red-600 hover:underline" title="Revocar de esta sede">Revocar</button>
                      </span>
                    ))}
                    {(r.sites ?? []).length === 0 && <span className="text-slate-400">Sin sede</span>}
                  </div>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => openAssign(r)} className="px-2 py-1.5 rounded border">Asignar</button>
                  <button onClick={() => openEdit(r)} className="px-2 py-1.5 rounded border">Editar</button>
                  {r.is_deleted ? (
                    <button onClick={() => onRestore(r.id)} className="px-2 py-1.5 rounded border">Restaurar</button>
                  ) : (
                    <button onClick={() => onDelete(r.id)} className="px-2 py-1.5 rounded border text-red-600">Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between text-sm">
        <div> Total: {total} </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded border disabled:opacity-50">Anterior</button>
          <span>Página {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded border disabled:opacity-50">Siguiente</button>
        </div>
      </div>

      {/* Modal: Crear */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => !busy && setCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-lg bg-white shadow p-5">
            <h3 className="text-lg font-semibold mb-4">Nuevo colaborador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-600 mb-1">Email</label>
                <input value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="ana@club.com" className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Nombre</label>
                <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Rol</label>
                <select value={cRole} onChange={(e) => setCRole(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                  <option value="STAFF">STAFF</option>
                  <option value="SITE_ADMIN">SITE_ADMIN</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-600 mb-1">Asignar a sedes (opcional)</label>
                <div className="max-h-48 overflow-auto border rounded p-2 space-y-1">
                  {(sites ?? []).length === 0 && <div className="text-sm text-slate-500">No hay sedes</div>}
                  {(sites ?? []).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={cSiteIds.includes(s.id)} onChange={() => toggleSiteCreate(s.id)} />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCreateOpen(false)} disabled={busy} className="px-3 py-2 rounded border">Cancelar</button>
              <button onClick={onCreate} disabled={!cEmail || busy} className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50">{busy ? "Creando…" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => !busy && setEditOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white shadow p-5">
            <h3 className="text-lg font-semibold mb-4">Editar colaborador</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Email</label>
                <input disabled value={eEmail} className="w-full px-3 py-2 border rounded bg-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Nombre</label>
                <input value={eName} onChange={(e) => setEName(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Rol</label>
                <select value={eRole} onChange={(e) => setERole(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                  <option value="STAFF">STAFF</option>
                  <option value="SITE_ADMIN">SITE_ADMIN</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditOpen(false)} disabled={busy} className="px-3 py-2 rounded border">Cancelar</button>
              <button onClick={onEdit} disabled={!eId || busy} className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => !busy && setAssignOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white shadow p-5">
            <h3 className="text-lg font-semibold mb-3">Asignar a sede</h3>
            <p className="text-sm text-slate-600 mb-4">Empleado: <span className="font-medium">{aEmail}</span></p>
            <label className="block text-sm text-slate-600 mb-1">Sede</label>
            <select value={aSiteId} onChange={(e) => setASiteId(e.target.value)} className="w-full px-3 py-2 border rounded mb-5">
              <option value="">Selecciona una sede…</option>
              {(sites ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignOpen(false)} disabled={busy} className="px-3 py-2 rounded border">Cancelar</button>
              <button onClick={confirmAssign} disabled={!aSiteId || busy} className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50">{busy ? "Asignando…" : "Asignar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Controles para abrir modales */}
      {/* Los botones están en la tabla: Nuevo, Editar, Eliminar/Restaurar, Asignar */}
    </div>
  );
}

// =============================================
// Integración sugerida en la ruta de settings (superadmin)
// File: app/superadmin/(protected)/orgs/[orgId]/settings/employees/page.tsx
// ----------------------------------------------
// "use client";
// import EmployeesCRUD from "@/components/employees/EmployeesCRUD";
// export default function EmployeesSettingsPage({ params }: { params: { orgId: string } }) {
//   return (
//     <div className="p-6 space-y-4">
//       <h2 className="text-xl font-semibold">Colaboradores</h2>
//       <EmployeesCRUD orgId={params.orgId} apiBase="/api/superadmin" />
//     </div>
//   );
// }
