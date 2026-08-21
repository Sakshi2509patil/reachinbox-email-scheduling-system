"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "./Button";

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function atTime(base: Date, hours: number, minutes: number) {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const PRESETS = [
  { label: "Tomorrow", get: () => atTime(addDays(new Date(), 1), 9, 0) },
  { label: "Tomorrow, 10:00 AM", get: () => atTime(addDays(new Date(), 1), 10, 0) },
  { label: "Tomorrow, 11:00 AM", get: () => atTime(addDays(new Date(), 1), 11, 0) },
  { label: "Tomorrow, 3:00 PM", get: () => atTime(addDays(new Date(), 1), 15, 0) },
];

export function SendLaterPicker({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: (isoLocal: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");

  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <p className="mb-2 text-sm font-medium text-gray-700">Send Later</p>

      <label className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500">
        <Calendar size={15} />
        <input
          type="datetime-local"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full bg-transparent text-sm text-gray-700 outline-none"
        />
      </label>

      <div className="mb-4 space-y-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setSelected(toLocalInputValue(p.get()))}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!selected} onClick={() => selected && onDone(selected)}>
          Done
        </Button>
      </div>
    </div>
  );
}
