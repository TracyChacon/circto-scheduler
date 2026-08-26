# Circto Scheduler Engine

A high-concurrency reservation engine built with **Next.js 15 (App Router)**, **TypeScript**, **Prisma 7**, and **PostgreSQL**. Designed to handle real-time slot generation and eliminate double-booking race conditions under heavy concurrent load using PostgreSQL transaction-level advisory locks.

---

## Key Features

- **Atomic Race Condition Protection:** Employs PostgreSQL `pg_advisory_xact_lock` to guarantee zero double-bookings when multiple users hit the same slot simultaneously.
- **Dynamic Availability Engine:** Calculates open appointment windows on the fly based on provider hours, custom slot durations, and existing active reservations.
- **Prisma 7 Driver Adapter Architecture:** Utilizes `@prisma/adapter-pg` with native `pg` connection pooling and root-level `prisma.config.ts` configuration.
- **Interactive Timezone-Aware UI:** Responsive React client wizard with client-side IANA timezone conversion using `Intl.DateTimeFormat`.
- **E2E & Concurrency Test Coverage:** Built-in Playwright end-to-end test suite and high-concurrency subshell scripts to verify lock performance.
- **Production Hardened:** Structured JSON logging, global API error middleware (`withApiHandler`), and active DB health checks via `/api/health`.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router, React 19) |
| **Language** | TypeScript |
| **Database** | PostgreSQL 16 (Containerized via Docker) |
| **ORM & Driver** | Prisma ORM v7.9.1 (`@prisma/adapter-pg`, `pg`) |
| **Styling** | Tailwind CSS |
| **Testing** | Playwright (E2E), Autocannon |

---

## Architecture & Concurrency Control

[ Client Request ]
                             │
                 POST /api/appointments
                             │
                    withApiHandler()
                             │
               ┌─────────────┴─────────────┐
               │  BEGIN SQL TRANSACTION   │
               └─────────────┬─────────────┘
                             │
             SELECT pg_advisory_xact_lock(...)
                             │
       ┌─────────────────────┴─────────────────────┐
       │                                           │

[ Lock Acquired ]                           [ Waiting... ]
│                                 Blocked until commit/rollback
Check Overlapping Bookings                           │
│                                           │
┌──────┴──────┐                           Re-evaluates overlap
│             │                                    │
(0 Overlaps)  (>0 Overlaps)                   Finds new record
│             │                                    │
Create Appt   Throw Error                            Returns
│             │                                409 Conflict
Commit Tx     Rollback Tx                             │
│             │                                    │
201 Created    409 Conflict ──────────────────────────┘

### Advisory Lock Mechanics
Standard `findFirst` followed by `create` operations invite race conditions during concurrent execution windows. To prevent double-bookings:

1. A transaction is initiated via `prisma.$transaction`.
2. A deterministic string key formatted as `${providerId}:${startTime}` is hashed using PostgreSQL `hashtext()`.
3. `SELECT pg_advisory_xact_lock(...)` acquires a transaction-level lock.
4. Any secondary request targeting the identical provider and start time halts execution at the database engine level.
5. Once the primary request commits its insert, the secondary request resumes, detects the existing reservation, and aborts with a `409 Conflict` response.

---

## Database Configuration (Prisma 7)

Prisma 7 decouples database connections from `schema.prisma`. Connections are managed explicitly via `prisma.config.ts` and the `@prisma/adapter-pg` driver adapter.

### `prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED
}

model Appointment {
  id            String            @id @default(uuid()) @db.Uuid
  providerId    String            @map("provider_id")
  startTime     DateTime          @map("start_time") @db.Timestamptz
  endTime       DateTime          @map("end_time") @db.Timestamptz
  customerName  String            @map("customer_name")
  customerEmail String            @map("customer_email")
  status        AppointmentStatus @default(CONFIRMED)
  metadata      Json?             @default("{}") @db.JsonB
  createdAt     DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime          @updatedAt @map("updated_at") @db.Timestamptz

  @@index([providerId, startTime, endTime])
  @@index([status])
  @@map("appointments")
}

```


### `prisma.config.ts`
```TypeScript

import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/appointment_db?schema=public',
  },
});

```

### `src/lib/db.ts`
```TypeScript

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

```

## Local Development Setup
### Prerequisite Requirements
```

- Node.js: v20.x or higher

- Docker & Docker Compose: Active engine instance

```

#### 1. Repository Initialization

```bash

git clone [https://github.com/your-username/circto-scheduler.git](https://github.com/your-username/circto-scheduler.git)
cd circto-scheduler
npm install

```

#### 2. Environment Setup

Create a `.env` file in the project root:
```Code snippet

DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/appointment_db?schema=public"
NODE_ENV="development"
```
#### 3. PostgreSQL Container Launch

Start the database service:
```bash

docker compose up -d

```
#### 4. Database Schema Push & Generation

Sync database tables and generate client types:
```bash

npx prisma db push
npx prisma generate

```
#### 5. Launch Development Server

``` bash

npm run dev

```
Navigate to http://localhost:3000 to interact with the scheduling wizard.

## API Documentation
### `GET /api/availability`

Computes non-overlapping available appointment slots for a specific provider.

Query Parameters:

    providerId (string, required)

    date (string YYYY-MM-DD, required)

    durationMinutes (number, optional, default: 60)

Response Example (`200 OK`):

```json

{
  "success": true,
  "slots": [
    {
      "startTime": "2026-09-01T09:00:00.000Z",
      "endTime": "2026-09-01T10:00:00.000Z",
      "available": true
    },
    {
      "startTime": "2026-09-01T10:00:00.000Z",
      "endTime": "2026-09-01T11:00:00.000Z",
      "available": false
    }
  ]
}

```

### `POST /api/appointments`

Creates a reservation protected by transaction-level advisory locking.

Request Body:
```json

{
  "providerId": "prov_123",
  "startTime": "2026-09-01T10:00:00Z",
  "durationMinutes": 60,
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "metadata": { "user_timezone": "America/Chicago" }
}

```

Response Success (`201 Created`):
``` json

{
  "success": true,
  "data": {
    "id": "c7a2b918-6831-4a2e-9d29-10fa3413cb38",
    "providerId": "prov_123",
    "startTime": "2026-09-01T10:00:00.000Z",
    "endTime": "2026-09-01T11:00:00.000Z",
    "status": "CONFIRMED"
  }
}

```

Response Conflict (`409 Conflict`):
```json

{
  "success": false,
  "error": "The requested time slot was just booked by another user. Please select a different time."
}

```

### `GET /api/health`

Health probe confirming API execution state and PostgreSQL database connectivity/latency.

Response Example (`200 OK`):

```json

{
  "status": "healthy",
  "timestamp": "2026-08-26T13:30:00.000Z",
  "uptime": 142.8,
  "database": {
    "status": "connected",
    "latencyMs": 4
  }
}

```

## Verification & Testing
### 1. Playwright E2E Test Suite

Executes browser automation tests covering timezone selection and full booking completion:

```bash

npx playwright test

```

### 2. Concurrency Simulation Script

Fires 10 asynchronous requests simultaneously to verify that exactly 1 request secures the slot while 9 return HTTP `409`:

```bash

for i in {1..10}; do
  curl -X POST http://localhost:3000/api/appointments \
    -H "Content-Type: application/json" \
    -d '{"providerId":"prov_123","startTime":"2026-09-01T10:00:00Z","durationMinutes":60,"customerName":"Tester '$i'","customerEmail":"test'$i'@example.com"}' \
    -w "\nHTTP Status: %{http_code}\n" &
done
wait

```

## License

`MIT`
