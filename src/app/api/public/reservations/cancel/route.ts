// app/api/public/reservations/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrgFromRequest } from '@/lib/org-from-request';
import { z } from 'zod';

const cancelSchema = z.object({
  code: z.string().min(4),
  reason: z.string().max(255).optional(),
});

const CANCELLATION_WINDOW_HOURS = 2; // ajústalo a tu política

export async function POST(req: NextRequest) {
  try {
    const org = await getOrgFromRequest();
    const body = await req.json();
    const { code, reason } = cancelSchema.parse(body);

    const reservation = await prisma.reservation.findFirst({
      where: {
        org_id: org.id,
        code,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: 'RESERVATION_NOT_FOUND' },
        { status: 404 },
      );
    }

    if (
      reservation.status !== 'HELD' &&
      reservation.status !== 'CONFIRMED'
    ) {
      return NextResponse.json(
        { ok: false, error: 'STATUS_NOT_CANCELLABLE' },
        { status: 400 },
      );
    }

    const now = new Date();
    const diffMs = reservation.start_time.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < CANCELLATION_WINDOW_HOURS) {
      return NextResponse.json(
        { ok: false, error: 'CANCELLATION_WINDOW_PASSED' },
        { status: 400 },
      );
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CANCELLED',
        cancelled_at: now,
        cancel_reason: reason ?? null,
      },
    });

    // Aquí podrías disparar lógica para liberar el slot, enviar mail, etc.

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_PAYLOAD', details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
