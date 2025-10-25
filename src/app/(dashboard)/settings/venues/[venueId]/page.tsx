export default function VenueSettingsPage({ params }: { params: { venueId: string } }) {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Sede {params.venueId}</h1>
      <p>Configuración avanzada.</p>
    </main>
  );
}
