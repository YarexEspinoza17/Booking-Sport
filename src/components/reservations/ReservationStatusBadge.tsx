// app/components/reservations/ReservationStatusBadge.tsx
import { reservationStatusClass, reservationStatusLabel, ReservationStatus } from '@/lib/reservations/types';

interface Props {
  status: ReservationStatus;
}

export function ReservationStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${reservationStatusClass[status]}`}
    >
      {reservationStatusLabel[status]}
    </span>
  );
}
