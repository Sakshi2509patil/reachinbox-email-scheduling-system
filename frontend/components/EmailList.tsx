"use client";

import { Search, SlidersHorizontal, RotateCw, Star, Clock } from "lucide-react";
import { ScheduledEmail, SentEmail } from "@/types";
import { LoadingSpinner, EmptyState } from "./Feedback";

function formatTimeBadge(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatSentTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface ScheduledProps {
  kind: "scheduled";
  items: ScheduledEmail[];
  loading: boolean;
  onRefresh: () => void;
}
interface SentProps {
  kind: "sent";
  items: SentEmail[];
  loading: boolean;
  onRefresh: () => void;
}

export function EmailList(props: ScheduledProps | SentProps) {
  const { kind, items, loading, onRefresh } = props;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400">
          <Search size={16} />
          <span>Search</span>
        </div>
        <button className="rounded-lg border border-gray-200 bg-white p-2 text-gray-400 hover:text-gray-600">
          <SlidersHorizontal size={16} />
        </button>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-400 hover:text-gray-600"
        >
          <RotateCw size={16} />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <LoadingSpinner label={`Loading ${kind} emails…`} />
        ) : items.length === 0 ? (
          <EmptyState
            title={kind === "scheduled" ? "No scheduled emails" : "No sent emails yet"}
            subtitle={
              kind === "scheduled"
                ? "Compose a new email to schedule your first send."
                : "Sent emails will show up here once they go out."
            }
          />
        ) : kind === "scheduled" ? (
          <div className="divide-y divide-gray-100">
            {items.map((row) => (
              <Row
                key={row.id}
                to={row.toEmail}
                subject={row.subject}
                preview=""
                rightBadge={
  <div className="flex items-center gap-2 whitespace-nowrap">
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600">
      <Clock size={11} />
      {formatTimeBadge(row.scheduledAt)}
    </span>

    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        row.status === "RATE_DELAYED"
          ? "bg-yellow-50 text-yellow-700"
          : "bg-blue-50 text-blue-600"
      }`}
    >
      {row.status === "RATE_DELAYED" ? "Rate Delayed" : "Scheduled"}
    </span>
  </div>
}              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((row) => (
              <Row
                key={row.id}
                to={row.toEmail}
                subject={row.subject}
                preview={row.status === "FAILED" && row.lastError ? row.lastError : formatSentTime(row.sentAt)}
                rightBadge={
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      row.status === "FAILED"
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {row.status === "FAILED" ? "Failed" : "Sent"}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  to,
  subject,
  preview,
  rightBadge,
}: {
  to: string;
  subject: string;
  preview: string;
  rightBadge: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 text-sm hover:bg-gray-50">
      <span className="w-48 shrink-0 truncate text-gray-500">To: {to}</span>
      {rightBadge}
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-gray-900">{subject}</span>
        {preview && <span className="text-gray-400"> — {preview}</span>}
      </span>
      <Star size={16} className="shrink-0 text-gray-300 hover:text-amber-400" />
    </div>
  );
}
