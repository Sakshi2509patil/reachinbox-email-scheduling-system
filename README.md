## Demo Video

A short demonstration of the ReachInbox Email Scheduler:

- Google OAuth login
- Dashboard
- Compose and schedule emails
- Scheduled and sent emails
- Ethereal email preview
- Restart recovery
- Rate limiting / minimum delay

[Watch the Demo Video](https://drive.google.com/file/d/1QwKpc7NCZm20vLTWj-coYPEwH09orgzR/view?usp=sharing)


# ReachInbox Email Scheduler

Production-grade full-stack email scheduling application built as a ReachInbox hiring assignment. The application schedules emails for future delivery using BullMQ, Redis, PostgreSQL, and Express, with a Next.js dashboard for managing campaigns.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Queue | BullMQ |
| Cache | Redis |
| Email | Nodemailer + Ethereal Email |
| Authentication | Google OAuth |
| Infrastructure | Docker Compose |

## Features

### Backend

- Schedule emails for future delivery
- Persistent BullMQ delayed jobs (no cron jobs)
- PostgreSQL storage using Prisma
- Redis-backed queue persistence
- Configurable worker concurrency
- Per-sender hourly rate limiting
- Automatic queue reconciliation after server restart
- Idempotent email processing to prevent duplicate sends
- CSV lead upload support

### Frontend

- Google OAuth login
- Dashboard showing scheduled and sent emails
- Compose new email modal
- CSV upload with email count preview
- Configure start time, delay between emails, and hourly limit
- Responsive UI built with Tailwind CSS
- Loading and empty states

## Project Structure

```text
reachinbox/
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── queue/
│   │   ├── routes/
│   │   ├── services/
│   │   └── server.ts
│   └── package.json
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
└── docker-compose.yml
```

## Setup Instructions

### Prerequisites

Install:

- Node.js 20+
- Docker Desktop
- Git

### Run the Backend

#### 1. Start PostgreSQL and Redis

From the project root:

```bash
docker compose up -d
```

This starts:

- PostgreSQL 16
- Redis 7 (AOF persistence enabled)

#### 2. Configure Environment

Create `backend/.env`:

```env
PORT=4000

DATABASE_URL="postgresql://reachinbox:reachinbox@localhost:5432/reachinbox"

REDIS_HOST=localhost
REDIS_PORT=6379

GOOGLE_CLIENT_ID=your-google-client-id

DEFAULT_MIN_DELAY_MS=2000
WORKER_CONCURRENCY=5
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MAX_SEND_ATTEMPTS=3

FRONTEND_URL=http://localhost:3000
```

#### 3. Install Dependencies

```bash
cd backend
npm install
```

#### 4. Generate Prisma Client

```bash
npx prisma generate
```

#### 5. Run Migrations

```bash
npx prisma migrate dev --name init
```

#### 6. Start Backend

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:4000
```

#### BullMQ Worker

The worker starts with the backend and processes delayed email jobs using Redis.

### Run the Frontend

#### 1. Configure Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

#### 2. Install Dependencies

```bash
cd frontend
npm install
```

#### 3. Start Frontend

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Ethereal Email Setup

This project uses Ethereal Email, a fake SMTP provider for testing.

**Create Credentials**

Inside the backend mail service, generate an Ethereal account using Nodemailer:

```js
const testAccount = await nodemailer.createTestAccount();
```

Or create one manually at Ethereal.

Add the credentials to `backend/.env`:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
```

After sending an email, preview it using:

```js
nodemailer.getTestMessageUrl(info);
```

This opens the email in Ethereal's web interface.

## Architecture Overview

### System Flow

1. User logs in using Google OAuth.
2. User creates a campaign from the dashboard.
3. Backend stores campaign data in PostgreSQL.
4. Each email is scheduled as a delayed BullMQ job.
5. Redis persists delayed jobs.
6. Worker processes jobs when their scheduled time arrives.
7. Email is sent via Ethereal SMTP.
8. Database status is updated.

### How Scheduling Works

- Campaign creation generates one BullMQ delayed job per recipient.
- Each job stores:
  - recipient
  - subject
  - body
  - sender
  - scheduled timestamp
- BullMQ automatically executes the job when the delay expires.
- No cron jobs are used.

### Persistence After Restart

The application survives server restarts because:

- BullMQ stores delayed jobs inside Redis.
- Redis runs with Append Only File (AOF) persistence.
- PostgreSQL stores campaign and email status permanently.

During server startup:

```js
reconcileScheduledEmails();
```

re-registers pending jobs that haven't been completed. This prevents future emails from being lost after a restart.

### Rate Limiting

The application enforces configurable hourly limits.

Example:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

Implementation:

- Redis maintains counters for each sender.
- Counters are keyed by hourly time windows.
- When the limit is reached:
  - jobs are delayed,
  - not discarded,
  - preserving send order as much as possible.

### Worker Concurrency

Concurrency is configurable.

```env
WORKER_CONCURRENCY=5
```

BullMQ processes multiple jobs safely in parallel while maintaining queue consistency.

A minimum delay between sends is also configurable.

```env
DEFAULT_MIN_DELAY_MS=2000
```

This simulates provider throttling.

## Features Checklist

### Backend

| Requirement | Status |
|-------------|--------|
| Express + TypeScript | ✅ |
| PostgreSQL + Prisma | ✅ |
| Redis | ✅ |
| BullMQ delayed jobs | ✅ |
| Persistent scheduling | ✅ |
| Restart recovery | ✅ |
| Worker concurrency | ✅ |
| Hourly rate limiting | ✅ |
| CSV upload | ✅ |
| Idempotent email sending | ✅ |

### Frontend

| Requirement | Status |
|-------------|--------|
| Google Login | ✅ |
| Dashboard | ✅ |
| Compose Email | ✅ |
| CSV Upload | ✅ |
| Scheduled Emails | ✅ |
| Sent Emails | ✅ |
| Loading States | ✅ |
| Empty States | ✅ |
| Tailwind UI | ✅ |

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Health check |
| `POST /api/campaigns` | Schedule emails |
| `GET /api/emails/scheduled` | Scheduled emails |
| `GET /api/emails/sent` | Sent emails |
| `GET /api/senders` | Available senders |

## Future Improvements

- Email analytics dashboard
- Retry dashboard for failed emails
- Multiple SMTP providers
- Campaign pause/resume
- WebSocket live updates
- Dockerized deployment for production
