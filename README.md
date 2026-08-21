# ReachInbox Email Scheduler

A production-style email scheduler: Express + BullMQ + Redis + Postgres backend,
Next.js + Tailwind frontend, Google OAuth login, Ethereal SMTP for sending.

## Quick start

```bash
# 1. infra
docker compose up -d          # postgres:5432, redis:6379

# 2. backend
cd backend
cp .env.example .env          # fill in GOOGLE_CLIENT_ID
npm install
npm run prisma:migrate        # creates tables
npm run seed:senders -- 3     # creates 3 real Ethereal test accounts
npm run dev                   # API on :4000
npm run worker                # separate process — the BullMQ worker

# 3. frontend
cd ../frontend
cp .env.example .env.local    # fill in NEXT_PUBLIC_GOOGLE_CLIENT_ID (same client)
npm install
npm run dev                   # UI on :3000
```

You'll need a Google OAuth **Web application** client ID with
`http://localhost:3000` as an authorized JavaScript origin. The frontend
gets a Google ID token via Google Identity Services and sends it as
`Authorization: Bearer <id_token>`; the backend verifies it directly against
Google's public keys with `google-auth-library` — no session/cookie layer,
no mock login.

## Architecture

```
frontend (Next.js)  --HTTP-->  backend (Express)  --enqueue-->  BullMQ (Redis)
                                     |                                |
                                     v                                v
                                 Postgres  <----- update on send ---- Worker
                                                                       |
                                                                       v
                                                                Ethereal SMTP
```

Postgres is the **source of truth**. Every recipient of a campaign gets its
own `EmailJob` row with a `status`, `scheduledAt`, and a deterministic
`bullJobId`. BullMQ/Redis only holds the *execution* side (delayed jobs) —
it can be thought of as a cache of "what to run when" that's always
reconcilable from Postgres.

## No cron

Scheduling is 100% BullMQ delayed jobs (`queue.add(name, data, { delay })`).
There is no `node-cron`, no OS crontab, and no polling loop scanning "what's
due right now" — BullMQ's own delayed-job timer in Redis handles that.

## Idempotency & duplicate-send prevention

Every BullMQ job is added with `jobId = EmailJob.id` (see `queue/queue.ts`).
BullMQ treats `jobId` as a unique key within a queue: calling `add()` again
with the same `jobId` is a no-op, it will never create a second job. This
single property is what makes the whole system idempotent:

- The API only ever calls `enqueueEmailJob(row.id, ...)`.
- Startup reconciliation (see below) only ever calls it with the same
  `row.id` for jobs it can't find.
- The worker itself checks `if (emailJob.status === "SENT") return;` as a
  second, cheap safety net before doing any SMTP work.

So even in the pathological case of the same row being enqueued twice
concurrently, at most one email goes out.

## Surviving a restart

Two layers:

1. **Redis persistence.** `docker-compose.yml` runs Redis with
   `--appendonly yes`, backed by a named volume. A normal restart of the
   Node process changes nothing — the delayed jobs are still sitting in
   Redis and fire on schedule.
2. **DB-driven reconciliation** (`queue/reconcile.ts`), run once on server
   boot before the HTTP server starts accepting traffic. It walks every
   `EmailJob` that isn't `SENT`/`FAILED`, checks whether a BullMQ job with
   that id still exists, and re-adds it if not (e.g. Redis volume wiped,
   fresh container, local dev without persistence). Because `jobId` is
   deterministic, this can never duplicate a send — worst case it's a
   no-op.

This means: if the server crashes at 2am with 500 emails still queued for
the morning, on restart every one of them either (a) is still scheduled in
Redis and fires normally, or (b) gets silently re-attached to its row and
fires at (or shortly after, if the scheduled time already passed) the
correct time. None are lost, none are duplicated, none restart "from
scratch."

## Concurrency

`WORKER_CONCURRENCY` (env, default 5) controls how many jobs the BullMQ
`Worker` will process in parallel. Since each job only touches its own
`EmailJob` row (looked up by its own id) and reserves its own Redis
rate-limit slot atomically, concurrent workers never race on shared state.

## Minimum delay between sends

Enforced via BullMQ's **queue-wide limiter**, not a `setTimeout` in the
worker body:

```ts
new Worker(QUEUE_NAME, processor, {
  concurrency: env.workerConcurrency,
  limiter: { max: 1, duration: env.defaultMinDelayMs }, // default: 2000ms
});
```

This caps the worker to starting at most 1 job per `defaultMinDelayMs`,
queue-wide, regardless of `concurrency`. **Trade-off worth calling out:**
the limiter throttles job *start* times, not completion times — with
concurrency > 1, a slow SMTP call could still overlap with the next job
starting `minDelayMs` later. For stricter "true serial" sending, set
`WORKER_CONCURRENCY=1`.

## Hourly rate limit (per sender)

`services/rateLimiter.ts` implements a Redis-backed sliding counter keyed
by `ratelimit:{senderId}:{YYYY-MM-DDTHH}`, using a single `EVAL` (Lua) that
does `INCR` + conditional `EXPIRE` + limit check atomically. This is safe
across multiple worker processes/instances — there's no in-memory count
that could drift between processes, and no read-then-write race, because
the whole reserve-a-slot operation is one atomic script.

`MAX_EMAILS_PER_HOUR_PER_SENDER` (env) is the fallback; each campaign can
also set its own `hourlyLimit` from the compose form, so different
campaigns/senders can have different caps.

**When the cap is hit:** the job is *not* failed or dropped. Inside the
worker, if `tryReserveSendSlot()` returns false, we compute the start of
the next UTC hour window, update the DB row's `scheduledAt` +
`status: RATE_DELAYED`, and call `job.moveToDelayed(nextWindow, token)` +
`throw new DelayedError()` — BullMQ's supported mechanism for a processor
to push its own job into the future instead of completing/failing it. The
job re-enters the delayed set and will be retried at the next window,
where it goes through the exact same rate-check again (so if the whole
next hour is also saturated, it keeps rolling forward one window at a
time). Relative order between rate-delayed jobs is preserved because
BullMQ's delayed set is a min-heap ordered by timestamp.

## Behavior under load (1000+ emails at once)

- **Enqueue is cheap.** `POST /api/campaigns` creates 1000 `EmailJob` rows
  in one Prisma transaction, then calls `enqueueEmailJob` per row. Adding a
  delayed job to BullMQ is just a Redis write (`ZADD` under the hood) —
  nothing executes until each job's delay elapses, so enqueueing 1000 jobs
  scheduled seconds apart takes well under a second.
- **Fan-out is bounded.** Even if all 1000 are scheduled for the same
  instant, only `WORKER_CONCURRENCY` execute in parallel, and the queue
  limiter caps starts to 1 per `defaultMinDelayMs` — so 1000 jobs "due
  now" drain at a controlled, configurable rate instead of hammering SMTP
  or the DB simultaneously.
- **Rate limit overflow spills forward, not sideways.** If the per-sender
  hourly cap is reached partway through the batch, the remainder rolls
  into the next hour window (see above) rather than erroring out — a
  1000-recipient campaign against a 200/hour sender cap simply takes ~5
  hours to fully drain, predictably.

## Environment variables (backend)

| Var | Purpose | Default |
|---|---|---|
| `DEFAULT_MIN_DELAY_MS` | min ms between individual sends | 2000 |
| `WORKER_CONCURRENCY` | parallel jobs processed | 5 |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | fallback hourly cap | 200 |
| `MAX_SEND_ATTEMPTS` | retries before `FAILED` | 3 |

None of these are hardcoded in application logic — all read from `config/env.ts`.

## What's stubbed / left for you to finish

- **Figma pixel-parity.** The dashboard, compose modal, and tables are
  functionally complete (loading/empty/error states, all required fields)
  but styled generically — I didn't have live access to the Figma file, so
  spacing/colors/typography need a pass against it directly.
- **Toasts.** Currently using inline `ErrorBanner`; swap in a toast lib
  (e.g. `sonner`) if you want non-blocking notifications.
- **Auto-refresh / polling** on the dashboard so scheduled → sent
  transitions show up without a manual reload (simple `setInterval` +
  refetch, or swap to SWR/React Query).
- **Prisma migration** hasn't been run against a live DB in this
  environment — run `npm run prisma:migrate` locally before first use.

## Suggested 35-hour time budget

| Hours | Focus |
|---|---|
| 0–1 | Read this repo, run `docker compose up`, get `/health` responding |
| 1–4 | Prisma migrate, seed senders, verify a manual `POST /api/campaigns` sends via Ethereal end-to-end |
| 4–8 | Kill the worker mid-run with jobs pending, restart, confirm `reconcile` logs recreate them and nothing double-sends |
| 8–12 | Load-test: schedule 1000 recipients at once with a low hourly cap, watch `RATE_DELAYED` rows roll forward correctly |
| 12–18 | Wire real Google Cloud OAuth credentials, confirm login → dashboard → logout flow |
| 18–28 | Match the frontend to Figma pixel-for-pixel (spacing, colors, the compose modal layout, table styling) |
| 28–32 | Polish empty/loading/error states, add toasts, add polling/refresh |
| 32–35 | Write up README notes on any deviations, record a short demo, buffer for surprises |
