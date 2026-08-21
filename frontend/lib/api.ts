import {
  ComposePayload,
  PaginatedResponse,
  ScheduledEmail,
  SentEmail,
  Sender,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(
  path: string,
  idToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export const api = {
  getSenders: (idToken: string) => request<{ items: Sender[] }>("/api/senders", idToken),

  getScheduled: (idToken: string, page = 1) =>
    request<PaginatedResponse<ScheduledEmail>>(
      `/api/emails/scheduled?page=${page}`,
      idToken
    ),

  getSent: (idToken: string, page = 1) =>
    request<PaginatedResponse<SentEmail>>(`/api/emails/sent?page=${page}`, idToken),

  createCampaign: (idToken: string, payload: ComposePayload) => {
    const form = new FormData();
    form.append("subject", payload.subject);
    form.append("body", payload.body);
    form.append("senderId", payload.senderId);
    form.append("startTime", payload.startTime);
    form.append("delayMs", String(payload.delaySeconds * 1000));
    form.append("hourlyLimit", String(payload.hourlyLimit));
    if (payload.leadsFile) form.append("leads", payload.leadsFile);
    if (payload.recipients) form.append("recipients", JSON.stringify(payload.recipients));

    return request<{ campaignId: string; recipients: number }>(
      "/api/campaigns",
      idToken,
      { method: "POST", body: form }
    );
  },
};

export { ApiError };
