import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { reconcileScheduledEmails } from "./queue/reconcile";
import campaignsRouter from "./routes/campaigns";
import emailsRouter from "./routes/emails";
import sendersRouter from "./routes/senders";

const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/campaigns", campaignsRouter);
app.use("/api/emails", emailsRouter);
app.use("/api/senders", sendersRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  // Persistence guarantee: reconcile DB <-> Redis before accepting traffic
  // so that if the process restarted (or Redis lost state) mid-flight, no
  // scheduled email is silently dropped or duplicated.
  await reconcileScheduledEmails();

  app.listen(env.port, () => {
    console.log(`[server] listening on :${env.port}`);
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
