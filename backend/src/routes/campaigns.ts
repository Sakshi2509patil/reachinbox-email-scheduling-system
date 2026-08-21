import { Router } from "express";
import multer from "multer";
import Papa from "papaparse";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { enqueueEmailJob } from "../queue/queue";
import { requireGoogleAuth, AuthedRequest } from "../middleware/auth";
import { env } from "../config/env";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

const composeSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  senderId: z.string().uuid(),
  startTime: z.string().datetime(), // ISO string
  delayMs: z.coerce.number().int().min(0).default(env.defaultMinDelayMs),
  hourlyLimit: z.coerce.number().int().min(1).default(env.defaultMaxEmailsPerHourPerSender),
  // recipients can also be sent as a JSON array instead of a file
  recipients: z.string().optional(),
});

function extractEmails(text: string): string[] {
  const emailRegex = /[^\s,;"'<>]+@[^\s,;"'<>]+\.[^\s,;"'<>]+/g;
  const found = text.match(emailRegex) ?? [];
  return [...new Set(found.map((e) => e.trim().toLowerCase()))];
}

/**
 * POST /api/campaigns
 * multipart/form-data: subject, body, senderId, startTime, delayMs,
 * hourlyLimit, and either a `leads` file (CSV/TXT) or a `recipients` JSON
 * array field.
 *
 * Creates one EmailJob per recipient, each spaced `delayMs` apart starting
 * at `startTime`, and enqueues each as a BullMQ delayed job with jobId =
 * EmailJob.id (idempotent — see queue/queue.ts).
 */
router.post(
  "/",
  requireGoogleAuth,
  upload.single("leads"),
  async (req: AuthedRequest, res) => {
    const parsed = composeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { subject, body, senderId, startTime, delayMs, hourlyLimit, recipients } =
      parsed.data;

    let emails: string[] = [];
    if (req.file) {
      const text = req.file.buffer.toString("utf-8");
      // Works for both a plain list and CSV (any column layout) since we
      // just regex out anything email-shaped.
      const csvParsed = Papa.parse(text);
      const flatText = csvParsed.data.flat().join(" ");
      emails = extractEmails(flatText || text);
    } else if (recipients) {
      try {
        const arr = JSON.parse(recipients);
        if (Array.isArray(arr)) emails = extractEmails(arr.join(" "));
      } catch {
        return res.status(400).json({ error: "recipients must be a JSON array" });
      }
    }

    if (emails.length === 0) {
      return res.status(400).json({ error: "No valid email addresses found" });
    }

    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    const start = new Date(startTime);

    const campaign = await prisma.campaign.create({
      data: {
        userId: req.user!.id,
        subject,
        body,
        startTime: start,
        delayMs,
        hourlyLimit,
        totalRecipients: emails.length,
      },
    });

    // Stagger each recipient's scheduledAt by delayMs. Actual throughput is
    // additionally capped by the worker's queue-wide limiter and the
    // per-sender hourly rate limit — this is just the requested spacing.
    const jobs = await prisma.$transaction(
      emails.map((to, i) =>
        prisma.emailJob.create({
          data: {
            campaignId: campaign.id,
            senderId: sender.id,
            toEmail: to,
            subject,
            body,
            scheduledAt: new Date(start.getTime() + i * delayMs),
            status: "PENDING",
          },
        })
      )
    );

    // Enqueue all at once. For 1000+ recipients this is still cheap —
    // BullMQ just writes delayed-set entries to Redis; nothing executes
    // until each one's scheduled time arrives.
    for (const job of jobs) {
      await enqueueEmailJob(job.id, job.scheduledAt);
    }
    const jobIds = jobs.map((j: { id: string }) => j.id);
    await prisma.emailJob.updateMany({
      where: { id: { in: jobIds } },
      data: { status: "QUEUED" },
    });
    // bullJobId = row id for every job just created (set individually to
    // satisfy the unique constraint safely)
    await Promise.all(
      jobs.map((j: { id: string }) =>
        prisma.emailJob.update({ where: { id: j.id }, data: { bullJobId: j.id } })
      )
    );

    res.status(201).json({
      campaignId: campaign.id,
      recipients: emails.length,
      scheduledFrom: start,
      scheduledTo: new Date(start.getTime() + (emails.length - 1) * delayMs),
    });
  }
);

export default router;
