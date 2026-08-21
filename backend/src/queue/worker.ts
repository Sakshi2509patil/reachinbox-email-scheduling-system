import { Worker, Job, DelayedError } from "bullmq";
import { redis } from "../db/redis";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME, EmailJobData } from "./queue";
import { tryReserveSendSlot, releaseSendSlot, nextHourWindowStart } from "../services/rateLimiter";
import { sendEmail } from "../services/mailer";

async function processEmailJob(job: Job<EmailJobData>, token?: string) {
  const { emailJobId } = job.data;

  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { sender: true, campaign: true },
  });

  // Guard: row deleted or already terminal (idempotency safety net in case
  // a duplicate job somehow got scheduled).
  if (!emailJob) return;
  if (emailJob.status === "SENT") return;

  const hourlyLimit = emailJob.campaign.hourlyLimit ?? env.defaultMaxEmailsPerHourPerSender;
  const now = new Date();

  const reserved = await tryReserveSendSlot(emailJob.senderId, hourlyLimit, now);

  if (!reserved) {
    // Hourly cap hit for this sender/window. Do NOT drop or fail the job —
    // push it to the next hour window, preserving its place in line
    // relative to other rate-delayed jobs (BullMQ delayed set is a min-heap
    // ordered by timestamp, so order is preserved for equal delays).
    const nextWindow = nextHourWindowStart(now);

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { status: "RATE_DELAYED", scheduledAt: nextWindow },
    });

    if (!token) {
      // Should not happen in normal operation (token is always provided by
      // the Worker when concurrency/lock is active), but fail safe.
      throw new Error("Missing job token; cannot delay job");
    }
    await job.moveToDelayed(nextWindow.getTime(), token);
    throw new DelayedError();
  }

  try {
    const result = await sendEmail(
      emailJob.sender,
      emailJob.toEmail,
      emailJob.subject,
      emailJob.body
    );

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        bullJobId: job.id,
        lastError: result.previewUrl ? `preview: ${result.previewUrl}` : null,
      },
    });
  } catch (err: any) {
    await releaseSendSlot(emailJob.senderId, now);
    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: {
        attempts: { increment: 1 },
        lastError: String(err?.message ?? err),
        status: emailJob.attempts + 1 >= env.maxSendAttempts ? "FAILED" : "PENDING",
      },
    });
    throw err; // let BullMQ's retry/backoff handle re-attempts
  }
}

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job, token) => processEmailJob(job, token),
  {
    connection: redis,
    concurrency: env.workerConcurrency,
    // Queue-wide throttle: at most 1 job STARTS every `defaultMinDelayMs`,
    // regardless of concurrency. This is what enforces "minimum delay
    // between individual sends" — see README for the concurrency vs.
    // limiter trade-off.
    limiter: {
      max: 1,
      duration: env.defaultMinDelayMs,
    },
  }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

emailWorker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

console.log(
  `[worker] started — concurrency=${env.workerConcurrency}, minDelayMs=${env.defaultMinDelayMs}`
);
