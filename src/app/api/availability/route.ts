import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const availabilityQuerySchema = z.object({
  providerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  durationMinutes: z.coerce.number().int().positive().default(60),
  startHour: z.coerce.number().int().min(0).max(23).default(9),  // 09:00 AM default
  endHour: z.coerce.number().int().min(1).max(24).default(17),   // 05:00 PM default
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = availabilityQuerySchema.parse({
      providerId: searchParams.get('providerId'),
      date: searchParams.get('date'),
      durationMinutes: searchParams.get('durationMinutes') ?? undefined,
      startHour: searchParams.get('startHour') ?? undefined,
      endHour: searchParams.get('endHour') ?? undefined,
    });

    const dayStart = new Date(`${query.date}T${String(query.startHour).padStart(2, '0')}:00:00.000Z`);
    const dayEnd = new Date(`${query.date}T${String(query.endHour).padStart(2, '0')}:00:00.000Z`);

    // Fetch existing non-cancelled bookings overlapping the requested day range
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        providerId: query.providerId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Generate candidate slot windows
    const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
    let currentSlotStart = new Date(dayStart);

    while (currentSlotStart.getTime() + query.durationMinutes * 60000 <= dayEnd.getTime()) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + query.durationMinutes * 60000);

      // Check collision with existing bookings
      const isOccupied = existingAppointments.some((appt) => {
        return appt.startTime < currentSlotEnd && appt.endTime > currentSlotStart;
      });

      slots.push({
        startTime: currentSlotStart.toISOString(),
        endTime: currentSlotEnd.toISOString(),
        available: !isOccupied,
      });

      // Increment by slot duration
      currentSlotStart = new Date(currentSlotStart.getTime() + query.durationMinutes * 60000);
    }

    return NextResponse.json({ success: true, slots });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation Error', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}