type Org = { id: string; name: string; slug: string; created_at: string };
export default function OrgTable({ data }: { data: Org[] }) {
  if (!data.length) {
    return (
      <div className="rounded-xl2 bg-card border border-border p-6 text-text-weak">
        No hay organizaciones registradas.
      </div>
    );
  }

  return (
    <div className="rounded-xl2 bg-card border border-border shadow-soft overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="bg-muted text-sm">
          <tr>
            <th className="text-left p-3 border-b border-border">Nombre</th>
            <th className="text-left p-3 border-b border-border">Slug</th>
            <th className="text-left p-3 border-b border-border">Creado</th>
          </tr>
        </thead>
        <tbody>
          {data.map((o) => (
            <tr key={o.id} className="hover:bg-muted/60">
              <td className="p-3 border-b border-border">{o.name}</td>
              <td className="p-3 border-b border-border text-primary">{o.slug}</td>
              <td className="p-3 border-b border-border">
                {new Date(o.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
