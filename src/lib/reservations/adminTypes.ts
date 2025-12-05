// app/lib/reservations/adminTypes.ts
import { ReservationStatus } from './types';

export type AdminReservation = {
  id: string;
  code: string;
  status: ReservationStatus;
  orgName: string;
  siteName: string;
  courtName: string;
  date: string;     // ISO date
  timeFrom: string; // '15:00'
  timeTo: string;   // '16:00'
  customerName: string;
  customerPhone?: string;
  createdAt: string; // ISO
};

export type ReservationFilters = {
  siteId?: string;
  courtId?: string;
  date?: string;
  status?: ReservationStatus | 'ALL';
  q?: string; // búsqueda por nombre/código
};
