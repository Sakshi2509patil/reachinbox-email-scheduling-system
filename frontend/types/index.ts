export type EmailStatus = "PENDING" | "QUEUED" | "RATE_DELAYED" | "SENT" | "FAILED";

export interface ScheduledEmail {
  id: string;
  toEmail: string;
  subject: string;
  scheduledAt: string;
  status: EmailStatus;
}

export interface SentEmail {
  id: string;
  toEmail: string;
  subject: string;
  sentAt: string | null;
  status: EmailStatus;
  lastError: string | null;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface ComposePayload {
  subject: string;
  body: string;
  senderId: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  leadsFile?: File;
  recipients?: string[];
}
