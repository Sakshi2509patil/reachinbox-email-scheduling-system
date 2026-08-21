import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),

  databaseUrl: required("DATABASE_URL"),

  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: parseInt(process.env.REDIS_PORT ?? "6379", 10),

  // Google OAuth (verified server-side via google-auth-library)
  googleClientId: required("GOOGLE_CLIENT_ID"),

  // --- Scheduler tuning (all configurable, nothing hardcoded) ---
  // Minimum delay between two consecutive sends, enforced via BullMQ's
  // queue-wide limiter (see queue/queue.ts). Default: 2 seconds.
  defaultMinDelayMs: parseInt(process.env.DEFAULT_MIN_DELAY_MS ?? "2000", 10),

  // Worker concurrency: how many jobs the worker will pull off the queue
  // in parallel. The limiter still throttles overall throughput even
  // when concurrency > 1 (see README "Rate limiting vs concurrency").
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY ?? "5", 10),

  // Global fallback hourly cap per sender if a campaign doesn't specify one.
  defaultMaxEmailsPerHourPerSender: parseInt(
    process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? "200",
    10
  ),

  // How many times to retry a failed send before marking FAILED.
  maxSendAttempts: parseInt(process.env.MAX_SEND_ATTEMPTS ?? "3", 10),

  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
};
