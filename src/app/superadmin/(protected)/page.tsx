export default function Dashboard() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
        <p className="mt-1 text-[color:hsl(var(--color-text-weak))]">Resumen general.</p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Organizaciones", value: "12" },
          { label: "Sedes", value: "28" },
          { label: "Canchas", value: "84" },
          { label: "Ingresos (30d)", value: "₡ 4.2M" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="text-sm text-[color:hsl(var(--color-text-weak))]">{k.label}</div>
            <div className="mt-1 text-2xl font-extrabold">{k.value}</div>
          </div>
        ))}
      </section>

      {/* Tabla simple */}
      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-bold">Reservas recientes</h2>
          <button className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-muted/60 text-[color:hsl(var(--color-text-weak))]">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Org</th>
                <th className="px-4 py-2 font-medium">Sede</th>
                <th className="px-4 py-2 font-medium">Cancha</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[1,2,3,4,5].map(i => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2">2025-10-24 18:00</td>
                  <td className="px-4 py-2">Club Palma</td>
                  <td className="px-4 py-2">Sede Central</td>
                  <td className="px-4 py-2">Pickle 1</td>
                  <td className="px-4 py-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">Confirmada</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
