import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireGoogleAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

/** GET /api/emails/scheduled — pending/queued/rate-delayed emails for the current user */
router.get("/scheduled", requireGoogleAuth, async (req: AuthedRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const pageSize = Math.min(100, parseInt(String(req.query.pageSize ?? "25"), 10));

  const where: Prisma.EmailJobWhereInput = {
  status: { in: ["PENDING", "QUEUED", "RATE_DELAYED"] },
  campaign: { userId: req.user!.id },
};

  const [items, total] = await Promise.all([
    prisma.emailJob.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        scheduledAt: true,
        status: true,
      },
    }),
    prisma.emailJob.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

/** GET /api/emails/sent — sent/failed emails for the current user */
router.get("/sent", requireGoogleAuth, async (req: AuthedRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const pageSize = Math.min(100, parseInt(String(req.query.pageSize ?? "25"), 10));

  const where: Prisma.EmailJobWhereInput = {
  status: { in: ["SENT", "FAILED"] },
  campaign: { userId: req.user!.id },
};
  const [items, total] = await Promise.all([
    prisma.emailJob.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        sentAt: true,
        status: true,
        lastError: true,
      },
    }),
    prisma.emailJob.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

export default router;
