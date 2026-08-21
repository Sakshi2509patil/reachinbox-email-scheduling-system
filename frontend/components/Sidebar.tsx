"use client";

import { Clock, Send, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Tab = "scheduled" | "sent";

export function Sidebar({
  tab,
  onTabChange,
  onCompose,
  scheduledCount,
  sentCount,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onCompose: () => void;
  scheduledCount: number;
  sentCount: number;
}) {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="px-5 pt-5">
        <div className="mb-5 text-xl font-extrabold tracking-tight text-gray-900">ONB</div>

        <button
          onClick={logout}
          title="Click to log out"
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-left hover:bg-gray-50"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-8 w-8 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
              {user?.name?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-gray-900">
              {user?.name}
            </p>
            <p className="truncate text-xs leading-tight text-gray-400">{user?.email}</p>
          </div>
          <ChevronDown size={16} className="shrink-0 text-gray-400" />
        </button>

        <button
          onClick={onCompose}
          className="mb-6 w-full rounded-full border border-green-500 py-2 text-sm font-medium text-green-600 transition hover:bg-green-50"
        >
          Compose
        </button>
      </div>

      <nav className="flex-1 px-5">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Core
        </p>
        <NavItem
          icon={<Clock size={16} />}
          label="Scheduled"
          count={scheduledCount}
          active={tab === "scheduled"}
          onClick={() => onTabChange("scheduled")}
        />
        <NavItem
          icon={<Send size={16} />}
          label="Sent"
          count={sentCount}
          active={tab === "sent"}
          onClick={() => onTabChange("sent")}
        />
      </nav>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
        active
          ? "bg-green-50 font-medium text-green-700"
          : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span className={active ? "text-green-600" : "text-gray-400"}>{count}</span>
    </button>
  );
}
