import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createBookingSchema = z.object({
  providerId: z.string().min(1),
  startTime: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = createBookingSchema.parse(body);

    const startTime = new Date(payload.startTime);
    const endTime = new Date(startTime.getTime() + payload.durationMinutes * 60000);

    // Compute deterministic string key for transaction advisory lock
    const lockKeyString = `${payload.providerId}:${startTime.toISOString()}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Acquire transaction-level advisory lock (automatically released on commit or rollback)
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockKeyString}));
      `;

      // 2. Validate double-booking overlap within lock boundary
      const existingOverlaps = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM "appointments"
        WHERE "provider_id" = ${payload.providerId}
          AND "status" IN ('CONFIRMED', 'PENDING')
          AND "start_time" < ${endTime}
          AND "end_time" > ${startTime};
      `;

      if (Number(existingOverlaps[0].count) > 0) {
        throw new Error('SLOT_OCCUPIED');
      }

      // 3. Atomically create appointment record
      return await tx.appointment.create({
        data: {
          providerId: payload.providerId,
          startTime,
          endTime,
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          status: 'CONFIRMED',
          metadata: payload.metadata ?? {},
        },
      });
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'SLOT_OCCUPIED') {
      return NextResponse.json(
        { success: false, error: 'The requested time slot was just booked by another user. Please choose another time.' },
        { status: 409 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}