"use client";

import { useEffect, useState } from "react";
import {
  defaultConnectionLabel,
  type D1Config,
  type StorageMode,
  truncateId,
} from "@/types/d1";

export type ConnectionModalMode = "add" | "edit";

interface ConnectionModalProps {
  open: boolean;
  mode: ConnectionModalMode;
  initialConfig: D1Config;
  initialLabel: string;
  initialStorageMode: StorageMode;
  onSave: (
    config: D1Config,
    storageMode: StorageMode,
    label: string,
  ) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  required?: boolean;
}

export function ConnectionModal({
  open,
  mode,
  initialConfig,
  initialLabel,
  initialStorageMode,
  onSave,
  onClose,
  saving,
  error,
  required = false,
}: ConnectionModalProps) {
  const [config, setConfig] = useState<D1Config>(initialConfig);
  const [label, setLabel] = useState(initialLabel);
  const [storageMode, setStorageMode] = useState<StorageMode>(initialStorageMode);

  useEffect(() => {
    if (open) {
      setConfig(initialConfig);
      setLabel(initialLabel);
      setStorageMode(initialStorageMode);
    }
  }, [open, initialConfig, initialLabel, initialStorageMode]);

  if (!open) return null;

  const update = (field: keyof D1Config, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedLabel =
      label.trim() || defaultConnectionLabel(config);
    await onSave(config, storageMode, resolvedLabel);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={required ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-modal-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-4">
          <div>
            <h2 id="connection-modal-title" className="text-sm font-semibold text-[#e6edf3]">
              {mode === "add" ? "Add Database Connection" : "Edit Connection"}
            </h2>
            <p className="mt-0.5 text-xs text-[#484f58]">
              Tokens are encrypted; account and database IDs are stored for display
            </p>
          </div>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#c9d1d9]">Label</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={defaultConnectionLabel(config) || "Production DB"}
              spellCheck={false}
              autoComplete="off"
              className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 text-sm text-[#e6edf3] placeholder:text-[#484f58] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#c9d1d9]">Account ID</span>
            <input
              type="text"
              value={config.accountId}
              onChange={(e) => update("accountId", e.target.value)}
              placeholder="Your Cloudflare Account ID"
              spellCheck={false}
              autoComplete="off"
              required
              className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 font-mono text-sm text-[#e6edf3] placeholder:text-[#484f58] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#c9d1d9]">Database ID</span>
            <input
              type="text"
              value={config.databaseId}
              onChange={(e) => update("databaseId", e.target.value)}
              placeholder="D1 Database UUID"
              spellCheck={false}
              autoComplete="off"
              required
              className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 font-mono text-sm text-[#e6edf3] placeholder:text-[#484f58] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
            />
            {config.databaseId && (
              <span className="font-mono text-[10px] text-[#484f58]">
                {truncateId(config.databaseId)}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#c9d1d9]">API Token</span>
            <input
              type="password"
              value={config.apiToken}
              onChange={(e) => update("apiToken", e.target.value)}
              placeholder="Bearer token (D1 read/write scope)"
              spellCheck={false}
              autoComplete="off"
              required
              className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 font-mono text-sm text-[#e6edf3] placeholder:text-[#484f58] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium text-[#c9d1d9]">Storage</legend>
            <div className="flex gap-2">
              <StorageOption
                label="Session"
                description="Cleared when tab closes"
                active={storageMode === "session"}
                onClick={() => setStorageMode("session")}
              />
              <StorageOption
                label="Local"
                description="Persists across sessions"
                active={storageMode === "local"}
                onClick={() => setStorageMode("local")}
              />
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-md bg-red-950/40 px-3 py-2 font-mono text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {!required && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[#30363d] px-4 py-2 text-xs font-medium text-[#c9d1d9] transition-colors hover:bg-[#21262d]"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#f97316] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Connecting…" : mode === "add" ? "Add & Connect" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StorageOption({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col rounded-md border px-3 py-2 text-left transition-colors ${
        active
          ? "border-[#f97316] bg-[#f97316]/10"
          : "border-[#30363d] bg-[#0f1117] hover:border-[#484f58]"
      }`}
    >
      <span className={`text-xs font-medium ${active ? "text-[#f97316]" : "text-[#c9d1d9]"}`}>
        {label}
      </span>
      <span className="text-[10px] text-[#484f58]">{description}</span>
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
