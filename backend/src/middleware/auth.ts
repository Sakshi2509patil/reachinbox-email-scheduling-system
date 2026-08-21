import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";
import { prisma } from "../db/prisma";

const client = new OAuth2Client(env.googleClientId);

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; name: string; avatarUrl: string | null };
}

/**
 * Expects `Authorization: Bearer <google_id_token>` — the ID token returned
 * to the frontend by Google Sign-In. We verify it against Google's public
 * keys (no shared secret needed) and upsert a local User row.
 */
export async function requireGoogleAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const idToken = header.slice("Bearer ".length);

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return res.status(401).json({ error: "Invalid Google token payload" });
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        name: payload.name ?? "",
        avatarUrl: payload.picture ?? null,
      },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture ?? null,
      },
    });

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
    next();
  } catch (err) {
    console.error("[auth] token verification failed:", err);
    return res.status(401).json({ error: "Invalid or expired Google token" });
  }
}
