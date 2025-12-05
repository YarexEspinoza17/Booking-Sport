"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CheckoutResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusMessage, setStatusMessage] = useState(
    "Procesando resultado del pago..."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const code = searchParams.get("code") ?? "";
        const description =
          searchParams.get("description") ?? "Sin descripción";
        const order = searchParams.get("order") ?? "";
        const tilopayTransaction =
          searchParams.get("tilopay-transaction") ?? "";
        const returnData = searchParams.get("returnData") ?? "";

        if (!returnData) {
          setErrorMessage("Falta returnData en la redirección de Tilopay.");
          setStatusMessage("No se pudo validar el pago.");
          return;
        }

        let paymentId: string | null = null;
        try {
          const decoded = Buffer.from(returnData, "base64").toString("utf8");
          const parsed = JSON.parse(decoded);
          paymentId = parsed.paymentId;
        } catch {
          setErrorMessage("Error al decodificar returnData.");
          setStatusMessage("No se pudo validar el pago.");
          return;
        }

        if (!paymentId) {
          setErrorMessage("No se encontró paymentId en returnData.");
          setStatusMessage("No se pudo validar el pago.");
          return;
        }

        const res = await fetch("/api/public/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId,
            code,
            order,
            tilopayTransaction,
            description,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setErrorMessage(
            data.error || "Error al confirmar el pago en el servidor."
          );
          setStatusMessage("El pago no fue aprobado o falló la confirmación.");
          return;
        }

        const reservationCode: string = data.reservationCode;

        setStatusMessage("Pago procesado, redirigiendo a la reserva...");

        router.push(`/reservations/${reservationCode}`);
      } catch (err) {
        console.error(err);
        setErrorMessage("Error inesperado al procesar el resultado del pago.");
        setStatusMessage("No se pudo validar el pago.");
      }
    };

    run();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md rounded-lg border p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold">
          Resultado de la transacción
        </h1>
        <p className="mb-2">{statusMessage}</p>

        {errorMessage && (
          <>
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>

            {/* Botón para regresar */}
            <button
              onClick={() => router.push("/book")}
              className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Volver a la reserva
            </button>
          </>
        )}
      </div>
    </main>
  );
}
