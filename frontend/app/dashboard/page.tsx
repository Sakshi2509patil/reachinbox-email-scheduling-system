"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ScheduledEmail, SentEmail } from "@/types";
import { Sidebar } from "@/components/Sidebar";
import { EmailList } from "@/components/EmailList";
import { ComposePage } from "@/components/ComposePage";
import { ErrorBanner } from "@/components/Feedback";

type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const { idToken } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("scheduled");
  const [composeOpen, setComposeOpen] = useState(false);

  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) router.replace("/");
  }, [idToken, router]);

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const [scheduledRes, sentRes] = await Promise.all([
        api.getScheduled(idToken),
        api.getSent(idToken),
      ]);
      setScheduled(scheduledRes.items);
      setScheduledTotal(scheduledRes.total);
      setSent(sentRes.items);
      setSentTotal(sentRes.total);
    } catch {
      setError("Couldn't load your emails. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (!idToken) return null;

  if (composeOpen) {
    return (
      <div className="flex h-screen">
        <Sidebar
          tab={tab}
          onTabChange={setTab}
          onCompose={() => setComposeOpen(true)}
          scheduledCount={scheduledTotal}
          sentCount={sentTotal}
        />
        <div className="flex-1">
          <ComposePage onClose={() => setComposeOpen(false)} onScheduled={load} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        tab={tab}
        onTabChange={setTab}
        onCompose={() => setComposeOpen(true)}
        scheduledCount={scheduledTotal}
        sentCount={sentTotal}
      />

      <main className="flex-1 overflow-y-auto px-8 py-6">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {tab === "scheduled" ? (
          <EmailList kind="scheduled" items={scheduled} loading={loading} onRefresh={load} />
        ) : (
          <EmailList kind="sent" items={sent} loading={loading} onRefresh={load} />
        )}
      </main>
    </div>
  );
}
