"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CourtForm } from "./CourtForm";
import Link from "next/link";

export function CourtsTable({
  loading,
  rows,
  total,
  page,
  per,
  onPageChange,
  onChanged,
  orgId,
}: {
  loading: boolean;
  rows: any[];
  total: number;
  page: number;
  per: number;
  onPageChange: (p: number) => void;
  onChanged: () => void;
  orgId: string;
}) {
  const [editRow, setEditRow] = useState<any | null>(null);

  async function softDelete(id: string) {
    if (!confirm("¿Eliminar (soft-delete) este court?")) return;
    const res = await fetch(`/api/superadmin/orgs/${orgId}/courts/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!json.ok) alert(json.error || "Error");
    else onChanged();
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3">Nombre</th>
            <th className="text-left p-3">Sede</th>
            <th className="text-left p-3">Tipo</th>
            <th className="text-left p-3">Buffers</th>
            <th className="text-left p-3">Estado</th>
            <th className="text-right p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-3">{r.name}</td>
              <td className="p-3">{r.site?.name}</td>
              <td className="p-3">{r.court_type?.name}</td>
              <td className="p-3">
                {r.buffer_before_minutes} / {r.buffer_after_minutes}
              </td>
              <td className="p-3">{r.active ? "Activo" : "Inactivo"}</td>
              <td className="p-3 text-right">
                <Dialog
                  open={!!editRow && editRow?.id === r.id}
                  onOpenChange={(o) => !o && setEditRow(null)}
                >
                  <DialogTrigger asChild>
                    <Button variant="secondary" onClick={() => setEditRow(r)}>
                      Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                      <DialogTitle>Editar court</DialogTitle>
                    </DialogHeader>
                    <CourtForm
                      orgId={orgId}
                      onSuccess={() => {
                        setEditRow(null);
                        onChanged();
                      }}
                      court={editRow || undefined}
                    />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="destructive"
                  className="ml-2"
                  onClick={() => softDelete(r.id)}
                >
                  Eliminar
                </Button>
                <Link
                  href={`/superadmin/orgs/${orgId}/settings/courts/${r.id}/schedule`}
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                >
                  Horarios
                </Link>
                <Link
                  href={`/superadmin/orgs/${orgId}/settings/courts/${r.id}/pricing`}
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                >
                  💰Precios
                </Link>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-muted-foreground">
                {loading ? "Cargando…" : "Sin resultados"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {/* Simple pagination */}
      <div className="flex items-center justify-between p-3">
        <span className="text-xs">Total: {total}</span>
        <div className="space-x-2">
          <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <Button
            disabled={page * per >= total}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
