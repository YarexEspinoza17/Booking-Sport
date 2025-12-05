"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { CourtForm } from "@/components/courts/CourtForm";
import { CourtsTable } from "@/components/courts/CourtsTable";

type Option = { id: string; name: string };

export default function CourtsPage({ params }: { params: { orgId: string } }) {
  const { orgId } = params;
  const search = useSearchParams();
  const router = useRouter();

  // tabla
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  // filtros/paginación (estado inicial desde la URL)
  const [page, setPage] = useState<number>(Number(search.get("page")) || 1);
  const [per, setPer] = useState<number>(Number(search.get("per")) || 10);
  const [q, setQ] = useState<string>(search.get("q") || "");
  const [siteFilter, setSiteFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // opciones para selects
  const [sites, setSites] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);

  // Carga opciones para los filtros
  useEffect(() => {
    (async () => {
      try {
        const [sRes, tRes] = await Promise.all([
          fetch(`/api/superadmin/orgs/${orgId}/sites?per=100`),
          fetch(`/api/superadmin/orgs/${orgId}/court-types?per=100`),
        ]);
        const sJson = await sRes.json();
        const tJson = await tRes.json();
        setSites((sJson?.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
        setTypes((tJson?.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
      } catch {
        // opcional: toast de error
      }
    })();
  }, [orgId]);

  // Construye querystring para API y para mantener URL en sync
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("page", String(page));
    p.set("per", String(per));
    if (siteFilter) p.set("site_id", siteFilter);
    if (typeFilter) p.set("court_type_id", typeFilter);
    return p.toString();
  }, [q, page, per, siteFilter, typeFilter]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/orgs/${orgId}/courts?${query}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error");
      setRows(json.data);
      setTotal(json.meta.total);
    } finally {
      setLoading(false);
    }
  }

  // sincroniza URL y carga datos
  useEffect(() => {
    router.replace(`?${query}`);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
      <Link href={`/superadmin/orgs/${orgId}/settings`} className="underline">
          ← Volver a configuración
        </Link>
        <h1 className="text-2xl font-semibold">Canchas</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Nuevo Cancha</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Crear court</DialogTitle>
            </DialogHeader>
            <CourtForm orgId={orgId} onSuccess={load} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Input
          placeholder="Buscar por nombre"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {/* Importante: NO usar value="" en SelectItem. Usamos un sentinela "__all". */}
        <Select
          value={siteFilter || "__all"}
          onValueChange={(v: string) => setSiteFilter(v === "__all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por sede" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter || "__all"}
          onValueChange={(v: string) => setTypeFilter(v === "__all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(per)} onValueChange={(v: string) => setPer(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Por página" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CourtsTable
        loading={loading}
        rows={rows}
        total={total}
        page={page}
        per={per}
        onPageChange={setPage}
        onChanged={load}
        orgId={orgId}
      />
    </div>
  );
}
