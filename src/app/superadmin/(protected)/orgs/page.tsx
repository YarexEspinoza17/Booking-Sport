"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";

type Org = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  is_deleted?: boolean;
};

type ListResponse = {
  ok: boolean;
  items: Org[];
  total: number;
  page: number;
  pages: number;
  per: number;
  sort: "created_at" | "name" | "slug";
  dir: "asc" | "desc";
};

// ===== THEME (usa tus tokens Tailwind) =====
const THEME = {
  primary: {
    bg: "bg-primary hover:opacity-90",
    ring: "focus:ring-2 focus:ring-primary",
    text: "text-primary",
  },
  success: {
    bg: "bg-green-600 hover:bg-green-700",
    ring: "focus:ring-2 focus:ring-green-400",
  },
  danger: {
    bg: "bg-red-600 hover:bg-red-700",
    ring: "focus:ring-2 focus:ring-red-400",
  },
  muted: {
    border: "border-border",
    bg: "bg-muted",
    text: "text-text",
    weak: "text-text-weak",
  },
};

const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");
const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : "";

// ===== Toasts =====
function useToasts() {
  const [msg, setMsg] = useState<string>("");
  const [type, setType] = useState<"success" | "error" | "info" | null>(null);
  const timerRef = useRef<number | null>(null);

  const show = useCallback(
    (m: string, t: "success" | "error" | "info" = "info") => {
      setMsg(m);
      setType(t);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setType(null);
        setMsg("");
      }, 3500);
    },
    []
  );

  const Toast = useMemo(() => {
    if (!type) return null as any;
    const color =
      type === "success"
        ? THEME.success.bg
        : type === "error"
        ? THEME.danger.bg
        : THEME.primary.bg;
    return (
      <div
        className={cls(
          "fixed top-4 right-4 z-[100] text-white px-4 py-2 rounded shadow-lg",
          color
        )}
      >
        {msg}
      </div>
    );
  }, [msg, type]);

  return { show, Toast } as const;
}

// ===== Modal pantalla completa =====
function FullscreenModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex text-text">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 m-auto w-[95vw] max-w-lg max-h-[90vh] overflow-auto rounded-xl shadow-xl bg-bg border border-border">
        <div className="sticky top-0 px-5 py-4 border-b border-border flex items-center justify-between bg-bg/90 backdrop-blur">
          <h3 className="font-semibold text-text">{title}</h3>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded hover:bg-muted transition"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ===== Confirmación =====
function Confirm({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <FullscreenModal open={open} onClose={onCancel} title={title}>
      <p className="text-sm mb-4 text-text">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className={cls("px-4 py-2 rounded border", THEME.muted.border)}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className={cls("px-4 py-2 rounded text-white", THEME.danger.bg)}
        >
          Eliminar
        </button>
      </div>
    </FullscreenModal>
  );
}

// ===== Modal Crear / Editar =====
function OrgModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Partial<Org>;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setSlug(initial?.slug ?? "");
      setError(null);
    }
  }, [open, initial?.id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = { name: name.trim(), slug: slug.trim() };
      if (!body.name || !body.slug)
        throw new Error("Complete todos los campos.");
      const resp = await fetch(
        isEdit ? `/api/superadmin/orgs/${initial!.id}` : "/api/superadmin/orgs",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await resp.json();
      if (!resp.ok || !json.ok)
        throw new Error(json?.error || "Error al guardar");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FullscreenModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Actualizar organización" : "Nueva organización"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Club Palma"
            className={cls(
              "w-full rounded px-3 py-2 outline-none placeholder-text-weak",
              THEME.muted.bg,
              THEME.muted.border,
              THEME.primary.ring,
              THEME.muted.text
            )}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="club-palma"
            className={cls(
              "w-full rounded px-3 py-2 outline-none placeholder-text-weak",
              THEME.muted.bg,
              THEME.muted.border,
              THEME.primary.ring,
              THEME.muted.text
            )}
          />
          <p className="text-xs text-text-weak mt-1">
            Solo minúsculas, números y guiones.
          </p>
        </div>
        {error && (
          <div
            className={cls("text-sm p-2 rounded text-white", THEME.danger.bg)}
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={cls("px-4 py-2 rounded border", THEME.muted.border)}
          >
            Cancelar
          </button>
          <button
            disabled={loading}
            type="submit"
            className={cls(
              "px-4 py-2 rounded text-white",
              loading ? "bg-slate-400" : THEME.success.bg
            )}
          >
            {isEdit ? "Actualizar" : "Crear"}
          </button>
        </div>
      </form>
    </FullscreenModal>
  );
}

export default function Page() {
  const { show, Toast } = useToasts();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(10);
  const [sort, setSort] = useState<"created_at" | "name" | "slug">(
    "created_at"
  );
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<Org | null>(null);
  const [openConfirm, setOpenConfirm] = useState<Org | null>(null);

  const debounceRef = useRef<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        page: String(page),
        per: String(per),
        sort,
        dir,
      });
      const res = await fetch(`/api/superadmin/orgs?${params.toString()}`, {
        cache: "no-store",
      });
      const json: ListResponse | { ok: false; error: string } =
        await res.json();
      if (!res.ok || !("ok" in json) || !json.ok)
        throw new Error((json as any)?.error || "Error al cargar");
      const data = json as ListResponse;
      setItems(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err: any) {
      show(err?.message ?? "Error al cargar", "error");
    } finally {
      setLoading(false);
    }
  }, [q, page, per, sort, dir, show]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onSearchChange = (val: string) => {
    setQ(val);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPage(1);
      reload();
    }, 350);
  };

  const toggleSort = (field: "created_at" | "name" | "slug") => {
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir("asc");
    }
  };

  const onDelete = async (org: Org) => {
    try {
      const resp = await fetch(`/api/superadmin/orgs/${org.id}`, {
        method: "DELETE",
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok)
        throw new Error(json?.error || "No se pudo eliminar");
      show("Organización eliminada", "success");
      reload();
    } catch (e: any) {
      show(e?.message ?? "Error al eliminar", "error");
    }
  };

  const headerBtn = (label: string, field: "created_at" | "name" | "slug") => (
    <button
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 hover:underline"
    >
      {label}
      {sort === field && (
        <span className="text-xs text-text-weak">
          {dir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </button>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto relative text-text">
      {Toast}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Organizaciones</h1>
        <button
          onClick={() => setOpenNew(true)}
          className={cls("px-4 py-2 rounded text-white", THEME.success.bg)}
        >
          Nueva organización
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nombre o slug..."
          className={cls(
            "w-full max-w-md rounded px-3 py-2 outline-none placeholder-text-weak",
            THEME.muted.bg,
            THEME.muted.border,
            THEME.muted.text,
            THEME.primary.ring
          )}
        />
        <select
          value={per}
          onChange={(e) => {
            setPer(Number(e.target.value));
            setPage(1);
          }}
          className={cls(
            "rounded px-3 py-2",
            THEME.muted.bg,
            THEME.muted.border
          )}
        >
          {[5, 10, 20, 30, 50].map((n) => (
            <option key={n} value={n}>
              {n} / pág.
            </option>
          ))}
        </select>
      </div>

      <div
        className={cls(
          "overflow-x-auto rounded-2xl border",
          THEME.muted.border
        )}
      >
        <table className={cls("min-w-full text-sm", THEME.muted.text)}>
          <thead className={cls("", THEME.muted.bg)}>
            <tr className="text-left">
              <th className="px-4 py-3">{headerBtn("Nombre", "name")}</th>
              <th className="px-4 py-3">{headerBtn("Slug", "slug")}</th>
              <th className="px-4 py-3">{headerBtn("Creada", "created_at")}</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-text-weak"
                >
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-text-weak"
                >
                  Sin resultados
                </td>
              </tr>
            )}
            {!loading &&
              items.map((org) => (
                <tr key={org.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{org.name}</td>
                  <td className="px-4 py-3">{org.slug}</td>
                  <td className="px-4 py-3">{formatDate(org.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
             

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {/* Ir a Settings general */}
                          <Link
                            href={`/superadmin/orgs/${org.id}/settings`}
                            className="px-3 py-1 rounded border border-border hover:opacity-90"
                            title="Configuración de la organización"
                          >
                            Configurar
                          </Link>

                          {/* Atajo directo a Sedes */}
                          <Link
                            href={`/superadmin/orgs/${org.id}/settings/sites`}
                            className="px-3 py-1 rounded border border-border hover:opacity-90"
                            title="Sedes"
                          >
                            Sedes
                          </Link>

                          {/* tus botones existentes */}
                          <button
                            className="px-3 py-1 rounded border border-border"
                            onClick={() => setOpenEdit(org)}
                          >
                            Editar
                          </button>
                          <button
                            className="px-3 py-1 rounded text-white bg-red-600 hover:bg-red-700"
                            onClick={() => setOpenConfirm(org)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <div>
          Total: <span className="font-semibold">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            className={cls(
              "px-3 py-1 rounded border",
              page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:opacity-90",
              THEME.muted.border
            )}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>
            Página {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            className={cls(
              "px-3 py-1 rounded border",
              page >= pages
                ? "opacity-50 cursor-not-allowed"
                : "hover:opacity-90",
              THEME.muted.border
            )}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modales */}
      <OrgModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onSaved={() => {
          show("Organización creada", "success");
          reload();
        }}
      />
      {openEdit && (
        <OrgModal
          open={true}
          onClose={() => setOpenEdit(null)}
          initial={openEdit}
          onSaved={() => {
            show("Organización actualizada", "success");
            reload();
          }}
        />
      )}
      <Confirm
        open={!!openConfirm}
        title="Eliminar organización"
        message="¿Seguro que deseas eliminar esta organización? (borrado lógico)"
        onCancel={() => setOpenConfirm(null)}
        onConfirm={() => {
          if (openConfirm) onDelete(openConfirm);
          setOpenConfirm(null);
        }}
      />
    </div>
  );
}
