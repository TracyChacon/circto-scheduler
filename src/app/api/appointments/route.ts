import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const bookingSchema = z.object({
  providerId: z.string(),
  startTime: z.string(),
  durationMinutes: z.number().default(60),
  customerName: z.string(),
  customerEmail: z.string().email(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = bookingSchema.parse(body);

    const start = new Date(validated.startTime);
    const end = new Date(start.getTime() + validated.durationMinutes * 60000);

    // FIX LINE 11: Pass explicit isolation level / timeout options or callback transaction
    const appointment = await prisma.$transaction(
      async (tx) => {
        // Advisory Lock Acquisition
        const lockKey = `${validated.providerId}:${start.toISOString()}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        // Check overlapping appointments
        const existing = await tx.appointment.findFirst({
          where: {
            providerId: validated.providerId,
            status: 'CONFIRMED',
            OR: [
              { startTime: { lte: start }, endTime: { gt: start } },
              { startTime: { lt: end }, endTime: { gte: end } },
            ],
          },
        });

        if (existing) {
          throw new Error('SLOT_OCCUPIED');
        }

        // FIX LINE 54: Cast metadata explicitly as Prisma.InputJsonObject
        const metadataJson = (validated.metadata ?? {}) as Prisma.InputJsonObject;

        return await tx.appointment.create({
          data: {
            providerId: validated.providerId,
            startTime: start,
            endTime: end,
            customerName: validated.customerName,
            customerEmail: validated.customerEmail,
            metadata: metadataJson,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    return NextResponse.json({ success: true, data: appointment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      // FIX LINE 69: Use error.issues instead of error.errors
      return NextResponse.json(
        { success: false, error: 'Validation Error', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'SLOT_OCCUPIED') {
      return NextResponse.json(
        { success: false, error: 'The requested time slot was just booked by another user. Please choose another time.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}