"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Paperclip, Clock, ChevronDown, X, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Sender } from "@/types";
import { ErrorBanner } from "./Feedback";
import { RichTextToolbar } from "./RichTextToolbar";
import { SendLaterPicker } from "./SendLaterPicker";

const EMAIL_REGEX = /[^\s,;"'<>]+@[^\s,;"'<>]+\.[^\s,;"'<>]+/g;

export function ComposePage({
  onClose,
  onScheduled,
}: {
  onClose: () => void;
  onScheduled: () => void;
}) {
  const { idToken } = useAuth();
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [subject, setSubject] = useState("");
  const [toInput, setToInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [hourlyLimit, setHourlyLimit] = useState(0);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) return;
    api.getSenders(idToken).then((r) => {
      setSenders(r.items);
      if (r.items[0]) setSenderId(r.items[0].id);
    });
  }, [idToken]);

  function addRecipientFromInput() {
    const found = toInput.match(EMAIL_REGEX);
    if (found) {
      setRecipients((prev) => [...new Set([...prev, ...found.map((e) => e.toLowerCase())])]);
    }
    setToInput("");
  }

  async function handleUploadList(f: File) {
    setLeadsFile(f);
    const text = await f.text();
    const found = new Set((text.match(EMAIL_REGEX) ?? []).map((e) => e.toLowerCase()));
    setRecipients((prev) => [...new Set([...prev, ...found])]);
  }

  async function handleSend(sendAtLocal: string) {
    if (!idToken) return;
    setError(null);

    const body = bodyRef.current?.innerText.trim() ?? "";
    if (!subject || !body || !senderId || recipients.length === 0) {
      setError("Add a subject, body, sender, and at least one recipient.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createCampaign(idToken, {
        subject,
        body,
        senderId,
        startTime: new Date(sendAtLocal).toISOString(),
        delaySeconds,
        hourlyLimit: hourlyLimit || 200,
        leadsFile: leadsFile ?? undefined,
        recipients: leadsFile ? undefined : recipients,
      });
      onScheduled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule campaign");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleChips = recipients.slice(0, 3);
  const overflow = recipients.length - visibleChips.length;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={18} />
        </button>
        <h2 className="flex-1 text-base font-medium text-gray-900">Compose New Email</h2>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Attach files"
        >
          <Paperclip size={17} />
          {leadsFile && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
              1
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Send later"
          >
            <Clock size={17} />
          </button>
          {pickerOpen && (
            <SendLaterPicker
              onCancel={() => setPickerOpen(false)}
              onDone={(iso) => {
                setStartTime(iso);
                setPickerOpen(false);
              }}
            />
          )}
        </div>

        <button
          onClick={() => handleSend(startTime ?? new Date().toISOString().slice(0, 16))}
          disabled={submitting}
          className="rounded-full bg-green-600 px-5 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? "Scheduling…" : startTime ? "Send Later" : "Send"}
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <FieldRow label="From">
          <div className="flex items-center gap-1 text-sm text-gray-700">
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="bg-transparent outline-none"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400" />
          </div>
        </FieldRow>

        <FieldRow label="To">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {visibleChips.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
              >
                {r}
                <button
                  onClick={() => setRecipients((prev) => prev.filter((x) => x !== r))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {overflow > 0 && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                +{overflow}
              </span>
            )}
            <input
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addRecipientFromInput();
                }
              }}
              onBlur={addRecipientFromInput}
              placeholder={recipients.length === 0 ? "recipient@example.com" : ""}
              className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="ml-2 flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700"
          >
            <Upload size={13} />
            Upload List
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUploadList(e.target.files[0])}
          />
        </FieldRow>

        <FieldRow label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </FieldRow>

        <div className="flex items-center gap-6 border-b border-gray-100 py-3 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            Delay between 2 emails (sec)
            <input
              type="number"
              min={0}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-14 rounded border border-gray-200 px-2 py-1 text-center text-sm"
            />
          </label>
          <label className="flex items-center gap-2">
            Hourly Limit
            <input
              type="number"
              min={0}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-14 rounded border border-gray-200 px-2 py-1 text-center text-sm"
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200">
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type Your Reply..."
            className="composer-body min-h-[220px] px-4 py-3 text-sm text-gray-800 outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
          />
          <RichTextToolbar targetRef={bodyRef} />
        </div>

        {leadsFile && (
          <p className="mt-2 text-xs text-gray-400">
            {recipients.length} recipient{recipients.length === 1 ? "" : "s"} detected from{" "}
            {leadsFile.name}
          </p>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center border-b border-gray-100 py-3 text-sm">
      <span className="w-16 shrink-0 text-gray-400">{label}</span>
      {children}
    </div>
  );
}
