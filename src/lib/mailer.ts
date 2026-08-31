import { Resend } from 'resend';
import { generateIcsBuffer } from './calendar';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendConfirmationParams {
  toEmail: string;
  customerName: string;
  startTime: Date;
  durationMinutes: number;
  appointmentId: string;
}

export async function sendBookingConfirmation(params: SendConfirmationParams) {
  const { toEmail, customerName, startTime, durationMinutes, appointmentId } = params;

  // 1. Generate .ics buffer
  const icsBuffer = await generateIcsBuffer({
    title: 'Consultation Session - Circto',
    description: `Confirmed reservation #${appointmentId}.`,
    startTime,
    durationMinutes,
    customerName,
    customerEmail: toEmail,
  });

  const formattedDate = startTime.toUTCString();
  const from = process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev';

  // 2. Dispatch via Resend API
  const response = await resend.emails.send({
    from,
    to: [toEmail],
    subject: 'Booking Confirmation - Circto Scheduler',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; margin-top: 0;">Reservation Confirmed!</h2>
        <p style="color: #334155; font-size: 16px;">Hi <strong>${customerName}</strong>,</p>
        <p style="color: #334155; font-size: 15px;">Your appointment has been successfully scheduled and locked.</p>
        
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;"><strong>Confirmation ID:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-family: monospace;">${appointmentId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;"><strong>Date & Time (UTC):</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;"><strong>Duration:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${durationMinutes} Minutes</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">We've attached a calendar invite (<code>invite.ics</code>) to this email so you can seamlessly add this session to your calendar.</p>
      </div>
    `,
    attachments: [
      {
        filename: 'invite.ics',
        content: icsBuffer,
      },
    ],
  });

  return response;
}