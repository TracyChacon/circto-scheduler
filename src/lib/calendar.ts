import { error } from "console";
import { createEvent, EventAttributes } from "ics";

interface CalendarEventParams {
    title: string;
    description: string;
    startTime: Date;
    durationMinutes: number;
    customerName: string;
    customerEmail: string;
}


export async function generateIcsBuffer(params: CalendarEventParams): Promise<Buffer> {
    const { title, description, startTime, durationMinutes, customerName, customerEmail } = params;

    const start: [number, number, number, number, number] = [
        startTime.getUTCFullYear(),
        startTime.getUTCMonth() + 1,
        startTime.getUTCDate(),
        startTime.getUTCHours(),
        startTime.getUTCMinutes()
    ]

    const event: EventAttributes = {
        start,
        duration: { minutes: durationMinutes },
        title,
        description,
        status: 'CONFIRMED',
        busyStatus: 'BUSY',
        attendees: [
            { name: customerName, email: customerEmail, rsvp: true, role: 'REQ-PARTICIPANT' }
        ],
    };

    return new Promise((resolve, reject) => {
        createEvent(event, (error, value) => {
            if(error) {
                return reject(error);
            }
            resolve(Buffer.from(value));
        });
    });
}