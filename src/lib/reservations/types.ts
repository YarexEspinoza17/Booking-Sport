// app/lib/reservations/types.ts
export type ReservationStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CANCELLED'
  | 'NO_SHOW';

export const reservationStatusLabel: Record<ReservationStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'En curso',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No se presentó',
};

export const reservationStatusClass: Record<ReservationStatus, string> = {
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_IN: 'bg-blue-100 text-blue-800 border-blue-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200 line-through',
  NO_SHOW: 'bg-slate-200 text-slate-700 border-slate-300',
};
