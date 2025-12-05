"use client";
import { useState } from "react";

export default function CreateOrgForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !slug) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/superadmin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setSlug("");
      setMsg("Organización creada");
      // refresca la página para ver la nueva org
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 items-end">
      <label className="grid gap-1">
        <span className="text-sm text-text-weak">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg bg-card"
          placeholder="Club Deportivo Palmares"
          required
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-text-weak">Slug (subdominio)</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}
          className="px-3 py-2 border border-border rounded-lg bg-card"
          placeholder="palmares"
          required
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-primary text-white border border-primary hover:opacity-90"
      >
        {loading ? "Creando..." : "Crear"}
      </button>
      {msg && <span className="text-sm text-text-weak">{msg}</span>}
    </form>
  );
}
