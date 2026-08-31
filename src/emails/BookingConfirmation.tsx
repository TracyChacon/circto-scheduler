import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface BookingConfirmationProps {
  customerName: string;
  startTime: string;
  endTime: string;
  timeZone: string;
}

export function BookingConfirmationEmail({
  customerName,
  startTime,
  endTime,
  timeZone,
}: BookingConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your session is confirmed for {startTime}</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '0 auto', padding: '20px 0 48px', marginBottom: '64px' }}>
          <Section style={{ padding: '0 48px' }}>
            <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
              Booking Confirmed!
            </Heading>
            <Text style={{ fontSize: '16px', color: '#444' }}>
              Hi {customerName}, your session has been successfully booked.
            </Text>
            <Hr style={{ borderColor: '#e6ebf1', margin: '20px 0' }} />
            <Text style={{ fontSize: '14px', color: '#555' }}>
              <strong>Start Time:</strong> {startTime} ({timeZone})<br />
              <strong>End Time:</strong> {endTime} ({timeZone})
            </Text>
            <Text style={{ fontSize: '12px', color: '#888', marginTop: '16px' }}>
              We have attached a calendar event (.ics) to this email so you can add it to Apple Calendar, Google Calendar, or Outlook.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}