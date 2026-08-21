import { prisma } from "../db/prisma";
import { emailQueue, enqueueEmailJob } from "./queue";

/**
 * Runs once on server startup.
 *
 * Why this is needed: BullMQ jobs live in Redis. In production Redis is
 * persisted (AOF/RDB + a Docker volume), so a plain server restart doesn't
 * lose anything — the delayed jobs are still there and will fire normally.
 * This function is the safety net for the case that actually matters for
 * the "survives restart" requirement: Redis itself was cleared/lost (e.g.
 * a fresh container, a dev restart without a volume) while Postgres (the
 * source of truth) still has the pending rows.
 *
 * For every EmailJob that is not yet SENT/FAILED, we check whether a
 * corresponding BullMQ job still exists (by our deterministic jobId =
 * EmailJob.id). If it doesn't, we recreate it at the correct future time.
 * Because jobId is deterministic and BullMQ dedupes on it, this is safe to
 * run repeatedly and can never create a duplicate send.
 */
export async function reconcileScheduledEmails() {
  const pending = await prisma.emailJob.findMany({
    where: { status: { in: ["PENDING", "QUEUED", "RATE_DELAYED"] } },
  });

  let recreated = 0;

  for (const row of pending) {
    const existing = row.bullJobId ? await emailQueue.getJob(row.bullJobId) : null;
    const existingById = existing ?? (await emailQueue.getJob(row.id));

    if (existingById) continue; // job already present in Redis — nothing to do

    // scheduledAt may be in the past if the server was down through it;
    // enqueueEmailJob clamps delay to >= 0 so it fires almost immediately.
    await enqueueEmailJob(row.id, row.scheduledAt);
    await prisma.emailJob.update({
      where: { id: row.id },
      data: { status: "QUEUED", bullJobId: row.id },
    });
    recreated++;
  }

  console.log(
    `[reconcile] checked ${pending.length} pending email(s), recreated ${recreated} missing job(s)`
  );
}
