// app/api/public/reservations/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrgFromRequest } from '@/lib/org-from-request';

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const org = await getOrgFromRequest();

    const reservation = await prisma.reservation.findFirst({
      where: {
        org_id: org.id,
        code: params.code,
      },
      include: {
        court: {
          include: {
            site: true,
          },
        },
        customer: true,
        payments: true, // por si quieres mostrar algo del pago
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: 'RESERVATION_NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: reservation.id,
        code: reservation.code,
        status: reservation.status,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        currency: reservation.currency,
        price_int: reservation.price_int,
        cancelled_at: reservation.cancelled_at,
        cancel_reason: reservation.cancel_reason,
        court: {
          id: reservation.court.id,
          name: reservation.court.name,
        },
        site: {
          id: reservation.court.site.id,
          name: reservation.court.site.name,
        },
        customer: reservation.customer
          ? {
              id: reservation.customer.id,
              full_name: reservation.customer.full_name,
              email: reservation.customer.email,
              phone: reservation.customer.phone,
            }
          : null,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
