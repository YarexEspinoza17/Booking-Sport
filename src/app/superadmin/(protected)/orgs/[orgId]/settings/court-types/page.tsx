// src/app/superadmin/orgs/[orgId]/court-types/page.tsx
"use client";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CourtType = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  created_at: string;
  is_deleted?: boolean | null;
};

type ListResponse = {
  ok: boolean;
  items: CourtType[];
  total: number;
  page: number;
  pages: number;
  per: number;
  sort: "created_at" | "code" | "name";
  dir: "asc" | "desc";
};

const THEME = {
  success: { bg: "bg-green-600 hover:bg-green-700" },
  danger: { bg: "bg-red-600 hover:bg-red-700" },
  primary: { ring: "focus:ring-2 focus:ring-primary" },
  muted: {
    border: "border-border",
    bg: "bg-card",
    text: "text-text",
    weak: "text-text-weak",
    soft: "bg-muted",
  },
};

const cls = (...p: Array<string | false | null | undefined>) => p.filter(Boolean).join(" ");
const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "");

// Toasts
function useToasts() {
  const [msg, setMsg] = useState<string>("");
  const [type, setType] = useState<"success" | "error" | "info" | null>(null);
  const timerRef = useRef<number | null>(null);
  const show = useCallback((m: string, t: "success" | "error" | "info" = "info") => {
    setMsg(m); setType(t);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { setMsg(""); setType(null); }, 3000);
  }, []);
  const Toast = useMemo(() => {
    if (!type) return null as any;
    const color = type === "success" ? THEME.success.bg : type === "error" ? THEME.danger.bg : "bg-primary";
    return <div className={cls("fixed top-4 right-4 z-[100] text-white px-4 py-2 rounded shadow-lg", color)}>{msg}</div>;
  }, [msg, type]);
  return { show, Toast } as const;
}

function FullscreenModal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex text-text">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 m-auto w-[95vw] max-w-lg max-h-[90vh] overflow-auto rounded-xl shadow-xl bg-bg border border-border">
        <div className="sticky top-0 px-5 py-4 border-b border-border flex items-center justify-between bg-bg/90 backdrop-blur">
          <h3 className="font-semibold">{" "}{title}</h3>
          <button onClick={onClose} className="px-2 py-1 rounded hover:bg-muted">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Confirm({ open, title, message, onCancel, onConfirm }: { open: boolean; title: string; message: string; onCancel: () => void; onConfirm: () => void; }) {
  if (!open) return null;
  return (
    <FullscreenModal open={open} onClose={onCancel} title={title}>
      <p className="text-sm mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className={cls("px-4 py-2 rounded border", THEME.muted.border)}>Cancelar</button>
        <button onClick={onConfirm} className={cls("px-4 py-2 rounded text-white", THEME.danger.bg)}>Eliminar</button>
      </div>
    </FullscreenModal>
  );
}

// Modal crear/editar
function TypeModal({ open, onClose, initial, onSaved, orgId }: {
  open: boolean; onClose: () => void; initial?: Partial<CourtType>; onSaved: () => void; orgId: string;
}) {
  const isEdit = Boolean(initial?.id);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setCode(initial?.code ?? ""); setName(initial?.name ?? ""); setError(null); }
  }, [open, initial?.id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const body = { code: code.trim(), name: name.trim() };
      const url = isEdit
        ? `/api/superadmin/orgs/${orgId}/court-types/${initial!.id}`
        : `/api/superadmin/orgs/${orgId}/court-types`;
      const method = isEdit ? "PATCH" : "POST";
      const resp = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json?.error || "Error al guardar");
      onSaved(); onClose();
    } catch (err: any) { setError(err?.message ?? "Error al guardar"); }
    finally { setLoading(false); }
  };

  return (
    <FullscreenModal open={open} onClose={onClose} title={isEdit ? "Editar tipo" : "Nuevo tipo"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Código</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="tennis"
                 className={cls("w-full rounded px-3 py-2 outline-none placeholder-text-weak", "bg-card border border-border", "text-text", THEME.primary.ring)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tenis"
                 className={cls("w-full rounded px-3 py-2 outline-none placeholder-text-weak", "bg-card border border-border", "text-text", THEME.primary.ring)} />
        </div>
        {error && <div className="text-white bg-red-600 rounded px-3 py-2 text-sm">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={cls("px-4 py-2 rounded border", THEME.muted.border)}>Cancelar</button>
          <button disabled={loading} type="submit" className={cls("px-4 py-2 rounded text-white", loading ? "bg-slate-400" : THEME.success.bg)}>
            {isEdit ? "Actualizar" : "Crear"}
          </button>
        </div>
      </form>
    </FullscreenModal>
  );
}

export default function CourtTypesPage({ params }: { params: { orgId: string } }) {
  const { orgId } = params;
  const { show, Toast } = useToasts();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(10);
  const [sort, setSort] = useState<"created_at" | "code" | "name">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CourtType[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<CourtType | null>(null);
  const [openConfirm, setOpenConfirm] = useState<CourtType | null>(null);

  const debounceRef = useRef<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ q, page: String(page), per: String(per), sort, dir });
      const res = await fetch(`/api/superadmin/orgs/${orgId}/court-types?` + sp.toString(), { cache: "no-store" });
      const json: ListResponse | { ok: false; error: string } = await res.json();
      if (!res.ok || !("ok" in json) || !json.ok) throw new Error((json as any)?.error || "Error al cargar");
      const data = json as ListResponse;
      setItems(data.items); setTotal(data.total); setPages(data.pages);
    } catch (err: any) { show(err?.message ?? "Error al cargar", "error"); }
    finally { setLoading(false); }
  }, [q, page, per, sort, dir, orgId, show]);

  useEffect(() => { reload(); }, [reload]);

  const onSearchChange = (val: string) => {
    setQ(val);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { setPage(1); reload(); }, 350);
  };

  const onDelete = async (row: CourtType) => {
    try {
      const resp = await fetch(`/api/superadmin/orgs/${orgId}/court-types/${row.id}`, { method: "DELETE" });
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json?.error || "No se pudo eliminar");
      show("Tipo eliminado", "success");
      reload();
    } catch (e: any) { show(e?.message ?? "Error al eliminar", "error"); }
  };

  const headerBtn = (label: string, field: "created_at" | "code" | "name") => (
    <button onClick={() => setSort((s) => (s === field ? (setDir(d => d === "asc" ? "desc" : "asc"), s) : (setDir("asc"), field)))}
            className="inline-flex items-center gap-1 hover:underline" title="Ordenar">
      {label}{sort === field && (<span className="text-xs text-text-weak">{dir === "asc" ? "▲" : "▼"}</span>)}
    </button>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto relative text-text">
        <Link href={`/superadmin/orgs/${orgId}/settings`} className="underline">
          ← Volver a configuración
        </Link>
      {Toast}

      <div className="flex items-center justify-between mb-4">
    
        <h2 className="text-xl font-semibold">Tipos de cancha</h2>
        <button onClick={() => setOpenNew(true)} className="px-4 py-2 rounded text-white bg-green-600 hover:bg-green-700">Nuevo tipo</button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input value={q} onChange={(e) => onSearchChange(e.target.value)} placeholder="Buscar por código o nombre…"
               className={cls("w-full max-w-md rounded px-3 py-2 outline-none placeholder-text-weak",
                              "bg-card border border-border", "text-text", "focus:ring-2 focus:ring-primary")} />
        <select value={per} onChange={(e) => { setPer(Number(e.target.value)); setPage(1); }}
                className={cls("rounded px-3 py-2 bg-card border border-border")}>
          {[5,10,20,30,50].map(n => <option key={n} value={n}>{n} / pág.</option>)}
        </select>
      </div>

      <div className={cls("overflow-x-auto rounded-2xl border", "border-border")}>
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-4 py-3">{headerBtn("Código", "code")}</th>
              <th className="px-4 py-3">{headerBtn("Nombre", "name")}</th>
              <th className="px-4 py-3">{headerBtn("Creado", "created_at")}</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={4} className="px-4 py-8 text-center text-text-weak">Cargando...</td></tr>)}
            {!loading && items.length === 0 && (<tr><td colSpan={4} className="px-4 py-8 text-center text-text-weak">Sin resultados</td></tr>)}
            {!loading && items.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{t.code}</td>
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3">{formatDate(t.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1 rounded border border-border" onClick={() => setOpenEdit(t)}>Editar</button>
                    <button className="px-3 py-1 rounded text-white bg-red-600 hover:bg-red-700" onClick={() => setOpenConfirm(t)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <div>Total: <span className="font-semibold">{total}</span></div>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} className={cls("px-3 py-1 rounded border border-border", page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:opacity-90")} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
          <span>Página {page} / {pages}</span>
          <button disabled={page >= pages} className={cls("px-3 py-1 rounded border border-border", page >= pages ? "opacity-50 cursor-not-allowed" : "hover:opacity-90")} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Siguiente</button>
        </div>
      </div>

      {/* Modales */}
      <TypeModal open={openNew} onClose={() => setOpenNew(false)} onSaved={() => { show("Tipo creado", "success"); reload(); }} orgId={orgId} />
      {openEdit && (
        <TypeModal open={true} onClose={() => setOpenEdit(null)} initial={openEdit} onSaved={() => { show("Tipo actualizado", "success"); reload(); }} orgId={orgId} />
      )}
      <Confirm open={!!openConfirm} title="Eliminar tipo" message="¿Seguro que deseas eliminar este tipo? (borrado lógico)" onCancel={() => setOpenConfirm(null)} onConfirm={() => { if (openConfirm) onDelete(openConfirm); setOpenConfirm(null); }} />
    </div>
  );
}
