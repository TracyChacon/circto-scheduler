import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // Optional: Seed an initial test appointment or provider metadata if needed
  const testAppointment = await prisma.appointment.create({
    data: {
      providerId: 'prov_123',
      startTime: new Date('2026-08-26T14:00:00Z'),
      endTime: new Date('2026-08-26T15:00:00Z'),
      customerName: 'Initial Seed Test',
      customerEmail: 'seed@example.com',
      status: 'CONFIRMED',
      metadata: { seed: true },
    },
  });

  console.log('Created seed appointment:', testAppointment.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });