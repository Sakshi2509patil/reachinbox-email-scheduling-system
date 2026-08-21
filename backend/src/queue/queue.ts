import { Queue } from "bullmq";
import { redis } from "../db/redis";
import { env } from "../config/env";

export const EMAIL_QUEUE_NAME = "email-send-queue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    // Jobs are removed from Redis once completed/failed *and* we've
    // persisted the outcome to Postgres — safe to drop from the queue.
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 24 * 3600 },
    attempts: env.maxSendAttempts,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export type EmailJobData = {
  emailJobId: string; // FK to EmailJob.id in Postgres — the source of truth
};

/**
 * Adds (or re-adds) a delayed send job for an EmailJob row.
 *
 * IDEMPOTENCY: jobId is set to the EmailJob's own id. BullMQ guarantees a
 * jobId can only exist once in a queue — calling add() again with the same
 * jobId is a safe no-op (it will not create a duplicate or restart the
 * job), which is exactly what we want on server-restart reconciliation.
 */
export async function enqueueEmailJob(emailJobId: string, sendAt: Date) {
  const delay = Math.max(0, sendAt.getTime() - Date.now());
  return emailQueue.add(
    "send-email",
    { emailJobId } satisfies EmailJobData,
    {
      jobId: emailJobId,
      delay,
    }
  );
}
