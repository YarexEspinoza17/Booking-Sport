"use client";
import EmployeesCRUD from "@/components/employees/EmployeesCRUD";
import Link from "next/link";

export default function EmployeesSettingsPage({ params }: { params: { orgId: string } }) {
  return (
    <div className="p-6 space-y-4">
        <Link href={`/superadmin/orgs/${params.orgId}/settings`} className="underline">
          ← Volver a configuración
        </Link>
      <h2 className="text-xl font-semibold">Colaboradores</h2>
      <EmployeesCRUD orgId={params.orgId} apiBase="/api/superadmin" canCreate />
    </div>
  );
}
