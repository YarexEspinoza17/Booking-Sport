"use client";
import EmployeesCRUD from "@/components/employees/EmployeesCRUD";

export default function EmployeesSettingsPage({ params }: { params: { orgId: string } }) {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Colaboradores</h2>
      <EmployeesCRUD orgId={params.orgId} apiBase="/api/superadmin" canCreate />
    </div>
  );
}
