// src/app/superadmin/orgs/[orgId]/settings/page.tsx
export default function OrgSettingsPage({ params }: { params: { orgId: string } }) {
  const { orgId } = params;
  const Tab = ({ href, label }: { href: string; label: string }) => (
    <a
      href={href}
      className="px-3 py-2 rounded border border-border hover:opacity-90 text-text"
    >
      {label}
    </a>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Configuración de la organización</h1>
      <div className="flex gap-2 mb-6">
        <Tab href={`/superadmin/orgs/${orgId}/settings`} label="General" />
        <Tab href={`/superadmin/orgs/${orgId}/settings/sites`} label="Sedes" />
        <Tab href={`/superadmin/orgs/${orgId}/settings/court-types`} label="Tipos de cancha" />
        <Tab href={`/superadmin/orgs/${orgId}/settings/courts`} label="Canchas" />
        <Tab href={`/superadmin/orgs/${orgId}/settings/employees`} label="Colaboradores" /> 
      </div>
      <p className="text-text-weak">Selecciona una pestaña…</p>
    </div>
  );
}
