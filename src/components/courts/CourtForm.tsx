"use client";

import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  site_id: z.string().uuid("Sede inválida"),
  court_type_id: z.string().uuid("Tipo inválido"),
  buffer_before_minutes: z.coerce.number().int().min(0).max(600),
  buffer_after_minutes: z.coerce.number().int().min(0).max(600),
  active: z.coerce.boolean(),
});

type FormValues = z.infer<typeof schema>;
type Option = { id: string; name: string };

export function CourtForm({
  orgId,
  onSuccess,
  court,
}: {
  orgId: string;
  onSuccess?: () => void;
  court?: {
    id: string;
    name: string;
    site_id: string;
    court_type_id: string;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    active: boolean;
  };
}) {
  const isEdit = Boolean(court);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          name: court!.name ?? "",
          site_id: court!.site_id ?? "",
          court_type_id: court!.court_type_id ?? "",
          buffer_before_minutes:
            typeof court!.buffer_before_minutes === "number" ? court!.buffer_before_minutes : 0,
          buffer_after_minutes:
            typeof court!.buffer_after_minutes === "number" ? court!.buffer_after_minutes : 0,
          active: typeof court!.active === "boolean" ? court!.active : true,
        }
      : {
          name: "",
          site_id: "",
          court_type_id: "",
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          active: true,
        },
  });

  const [sites, setSites] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // --- helper para normalizar cualquier payload ---
  function pickArray(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    // algunos devuelven { ok:true, data:{ items:[...] } }
    if (payload.data && Array.isArray(payload.data.items)) return payload.data.items;
    return [];
  }

  useEffect(() => {
    let ignore = false;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [sRes, tRes] = await Promise.all([
          fetch(`/api/superadmin/orgs/${orgId}/sites?per=100`, {
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
          fetch(`/api/superadmin/orgs/${orgId}/court-types?per=100`, {
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
        ]);

        const [sJson, tJson] = await Promise.all([
          sRes.json().catch(() => ({})),
          tRes.json().catch(() => ({})),
        ]);

        if (ignore) return;

        // logs útiles para depurar estructura
        console.debug("[CourtForm] sites payload:", sJson);
        console.debug("[CourtForm] types payload:", tJson);

        const sArr = pickArray(sJson);
        const tArr = pickArray(tJson);

        setSites(sArr.map((x: any) => ({ id: x.id, name: x.name })));
        setTypes(tArr.map((x: any) => ({ id: x.id, name: x.name })));

        if (!isEdit) {
          if (sArr.length > 0) setValue("site_id", sArr[0].id, { shouldValidate: true });
          if (tArr.length > 0) setValue("court_type_id", tArr[0].id, { shouldValidate: true });
        }

        if (!sRes.ok || !tRes.ok || sArr.length === 0 || tArr.length === 0) {
          console.warn("[CourtForm] loadOptions warning", {
            sites_status: sRes.status,
            types_status: tRes.status,
            sArrLen: sArr.length,
            tArrLen: tArr.length,
          });
        }
      } catch (err) {
        console.error("[CourtForm] Error cargando sedes/tipos", err);
        setSites([]);
        setTypes([]);
      } finally {
        if (!ignore) setLoadingOptions(false);
      }
    }

    loadOptions();
    return () => {
      ignore = true;
    };
  }, [orgId, isEdit, setValue]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const url = isEdit
      ? `/api/superadmin/orgs/${orgId}/courts/${court!.id}`
      : `/api/superadmin/orgs/${orgId}/courts`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(values),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      console.error("[CourtForm] submit error", res.status, json);
      throw new Error(json?.error || "Error");
    }
    onSuccess?.();
  };

  const currentSiteId = watch("site_id");
  const currentTypeId = watch("court_type_id");

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nombre */}
        <div>
          <label className="text-sm">Nombre</label>
          <Input {...register("name")} placeholder="Court A" />
          {errors.name && <p className="text-xs text-red-500">{String(errors.name.message)}</p>}
        </div>

        {/* Sede */}
        <div className="relative">
          <label className="text-sm">Sede</label>
          <Select
            value={currentSiteId || undefined}
            onValueChange={(v: string) => setValue("site_id", v, { shouldValidate: true })}
            disabled={loadingOptions || sites.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingOptions ? "Cargando..." : (sites.length ? "Seleccione" : "No hay sedes")} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={8} className="z-[90] max-h-60 overflow-auto">
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.site_id && <p className="text-xs text-red-500">Sede requerida</p>}
        </div>

        {/* Tipo de cancha */}
        <div className="relative">
          <label className="text-sm">Tipo de cancha</label>
          <Select
            value={currentTypeId || undefined}
            onValueChange={(v: string) => setValue("court_type_id", v, { shouldValidate: true })}
            disabled={loadingOptions || types.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingOptions ? "Cargando..." : (types.length ? "Seleccione" : "No hay tipos")} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={8} className="z-[90] max-h-60 overflow-auto">
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.court_type_id && <p className="text-xs text-red-500">Tipo requerido</p>}
        </div>

        {/* Buffers */}
        <div>
          <label className="text-sm">Buffer antes (min)</label>
          <Input type="number" {...register("buffer_before_minutes", { valueAsNumber: true })} />
          {errors.buffer_before_minutes && (
            <p className="text-xs text-red-500">{String(errors.buffer_before_minutes.message)}</p>
          )}
        </div>

        <div>
          <label className="text-sm">Buffer después (min)</label>
          <Input type="number" {...register("buffer_after_minutes", { valueAsNumber: true })} />
          {errors.buffer_after_minutes && (
            <p className="text-xs text-red-500">{String(errors.buffer_after_minutes.message)}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting || loadingOptions}>
          {isEdit ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
