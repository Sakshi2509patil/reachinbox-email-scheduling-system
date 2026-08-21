import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireGoogleAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireGoogleAuth, async (_req, res) => {
  const senders = await prisma.sender.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json({ items: senders });
});

export default router;
