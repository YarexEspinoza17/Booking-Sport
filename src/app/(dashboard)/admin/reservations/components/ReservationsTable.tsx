// app/admin/reservations/ReservationsTable.tsx

type Reservation = {
    id: string;
    code: string;
    status: string;
    start_time: Date;
    end_time: Date;
    currency: 'CRC' | 'USD';
    price_int: number;
    court: { name: string; site: { name: string } };
    customer: { full_name: string | null; email: string | null } | null;
  };
  
  export default function ReservationsTable({
    reservations,
  }: {
    reservations: Reservation[];
  }) {
    if (reservations.length === 0) {
      return <p>No hay reservas para los filtros seleccionados.</p>;
    }
  
    return (
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Fecha / hora</th>
              <th className="px-3 py-2 text-left">Sede</th>
              <th className="px-3 py-2 text-left">Cancha</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.code}</td>
                <td className="px-3 py-2">
                  {new Date(r.start_time).toLocaleString()}
                </td>
                <td className="px-3 py-2">{r.court.site.name}</td>
                <td className="px-3 py-2">{r.court.name}</td>
                <td className="px-3 py-2">
                  {r.customer
                    ? `${r.customer.full_name ?? '-'} (${r.customer.email ?? '-'})`
                    : '-'}
                </td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-right">
                  {r.price_int / 100} {r.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  