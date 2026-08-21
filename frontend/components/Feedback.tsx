import { EmailStatus } from "@/types";

export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
      {message}
    </div>
  );
}

const statusStyles: Record<EmailStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  QUEUED: "bg-blue-50 text-blue-700",
  RATE_DELAYED: "bg-amber-50 text-amber-700",
  SENT: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {status.replace("_", " ").toLowerCase()}
    </span>
  );
}
