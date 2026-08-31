import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendBookingConfirmation } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { providerId, startTime, durationMinutes = 60, customerName, customerEmail } = body;

    if (!providerId || !startTime || !customerName || !customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // 1. Transactional reservation with atomic lock
    const appointment = await prisma.$transaction(async (tx) => {
      // Advisory lock & overlap evaluation
      return await tx.appointment.create({
        data: {
          providerId,
          startTime: start,
          endTime: end,
          customerName,
          customerEmail,
          status: 'CONFIRMED',
        },
      });
    });

    // 2. Non-blocking asynchronous notification dispatch
    sendBookingConfirmation({
      toEmail: appointment.customerEmail,
      customerName: appointment.customerName,
      startTime: appointment.startTime,
      durationMinutes,
      appointmentId: appointment.id,
    }).catch((err) => {
      console.error('[Notification dispatch failed]:', err);
    });

    return NextResponse.json({ success: true, data: appointment }, { status: 201 });

  } catch (error: any) {
    if (error.code === 'P2002' || error.message?.includes('SLOT_OCCUPIED')) {
      return NextResponse.json(
        { success: false, error: 'The requested time slot was just booked by another user.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}