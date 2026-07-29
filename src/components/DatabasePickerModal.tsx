"use client";

import { useEffect, useState } from "react";
import {
  defaultConnectionLabel,
  type CfAccountOption,
  type CfDatabaseOption,
  truncateId,
} from "@/types/d1";
import { fetchAccounts, fetchDatabases } from "@/lib/studio-api";

export type DatabasePickerMode = "add" | "edit";

interface DatabasePickerModalProps {
  open: boolean;
  mode: DatabasePickerMode;
  initialLabel: string;
  initialAccountId?: string;
  initialDatabaseId?: string;
  onSave: (input: {
    accountId: string;
    databaseId: string;
    label: string;
  }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  required?: boolean;
}

export function DatabasePickerModal({
  open,
  mode,
  initialLabel,
  initialAccountId = "",
  initialDatabaseId = "",
  onSave,
  onClose,
  saving,
  error,
  required = false,
}: DatabasePickerModalProps) {
  const [label, setLabel] = useState(initialLabel);

  if (!open) return null;

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
        aria-labelledby="database-picker-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-4">
          <div>
            <h2 id="database-picker-title" className="text-sm font-semibold text-[#e6edf3]">
              {mode === "add" ? "Add D1 Database" : "Edit Connection Label"}
            </h2>
            <p className="mt-0.5 text-xs text-[#484f58]">
              {mode === "add"
                ? "Pick a database from your Cloudflare account"
                : "Update the display label for this connection"}
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

        {mode === "add" ? (
          <AddDatabaseForm
            key="add-database-form"
            label={label}
            onLabelChange={setLabel}
            onSave={onSave}
            onClose={onClose}
            saving={saving}
            error={error}
            required={required}
          />
        ) : (
          <EditLabelForm
            initialLabel={initialLabel}
            initialDatabaseId={initialDatabaseId}
            label={label}
            onLabelChange={setLabel}
            onSave={onSave}
            onClose={onClose}
            saving={saving}
            error={error}
            required={required}
            initialAccountId={initialAccountId}
          />
        )}
      </div>
    </div>
  );
}

function AddDatabaseForm({
  label,
  onLabelChange,
  onSave,
  onClose,
  saving,
  error,
  required,
}: {
  label: string;
  onLabelChange: (value: string) => void;
  onSave: DatabasePickerModalProps["onSave"];
  onClose: () => void;
  saving: boolean;
  error: string | null;
  required: boolean;
}) {
  const [accounts, setAccounts] = useState<CfAccountOption[]>([]);
  const [databases, setDatabases] = useState<CfDatabaseOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [databasesLoading, setDatabasesLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [databaseId, setDatabaseId] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchAccounts()
      .then((items) => {
        if (cancelled) return;
        setAccounts(items);
        const nextAccountId = items[0]?.id ?? "";
        setAccountId(nextAccountId);
        if (nextAccountId) setDatabasesLoading(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load accounts");
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;

    let cancelled = false;

    fetchDatabases(accountId)
      .then((items) => {
        if (cancelled) return;
        setDatabases(items);
        setDatabaseId(items[0]?.uuid ?? "");
        setDatabasesLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load databases");
        setDatabases([]);
        setDatabaseId("");
        setDatabasesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const handleAccountChange = (nextAccountId: string) => {
    setAccountId(nextAccountId);
    setDatabases([]);
    setDatabaseId("");
    setDatabasesLoading(Boolean(nextAccountId));
  };

  const selectedDatabase = databases.find((db) => db.uuid === databaseId);
  const resolvedLabel =
    label.trim() ||
    (selectedDatabase?.name ??
      defaultConnectionLabel({ databaseId: databaseId || "database" }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !databaseId) return;
    await onSave({ accountId, databaseId, label: resolvedLabel });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#c9d1d9]">Account</span>
        <select
          value={accountId}
          onChange={(e) => handleAccountChange(e.target.value)}
          disabled={accountsLoading || accounts.length === 0}
          required
          className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
        >
          {accountsLoading && <option value="">Loading accounts…</option>}
          {!accountsLoading && accounts.length === 0 && (
            <option value="">No accounts found</option>
          )}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#c9d1d9]">D1 Database</span>
        <select
          value={databaseId}
          onChange={(e) => setDatabaseId(e.target.value)}
          disabled={databasesLoading || databases.length === 0 || !accountId}
          required
          className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
        >
          {databasesLoading && <option value="">Loading databases…</option>}
          {!databasesLoading && databases.length === 0 && (
            <option value="">No D1 databases in this account</option>
          )}
          {databases.map((database) => (
            <option key={database.uuid} value={database.uuid}>
              {database.name}
            </option>
          ))}
        </select>
        {databaseId && (
          <span className="font-mono text-[10px] text-[#484f58]">
            {truncateId(databaseId)}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#c9d1d9]">Label</span>
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={resolvedLabel || "Production DB"}
          spellCheck={false}
          autoComplete="off"
          className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 text-sm text-[#e6edf3] placeholder:text-[#484f58] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
        />
      </label>

      {(error || loadError) && (
        <p role="alert" className="rounded-md bg-red-950/40 px-3 py-2 font-mono text-xs text-red-300">
          {error ?? loadError}
        </p>
      )}

      <FormActions
        required={required}
        saving={saving}
        onClose={onClose}
        submitLabel="Add & Connect"
        disabled={
          saving ||
          !accountId ||
          !databaseId ||
          accountsLoading ||
          databasesLoading
        }
      />
    </form>
  );
}

function EditLabelForm({
  initialLabel,
  initialAccountId,
  initialDatabaseId,
  label,
  onLabelChange,
  onSave,
  onClose,
  saving,
  error,
  required,
}: {
  initialLabel: string;
  initialAccountId: string;
  initialDatabaseId: string;
  label: string;
  onLabelChange: (value: string) => void;
  onSave: DatabasePickerModalProps["onSave"];
  onClose: () => void;
  saving: boolean;
  error: string | null;
  required: boolean;
}) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      accountId: initialAccountId,
      databaseId: initialDatabaseId,
      label: label.trim() || initialLabel,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
      <div className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 text-xs text-[#8b949e]">
        <p>{initialLabel}</p>
        <p className="mt-1 font-mono text-[10px] text-[#484f58]">
          {truncateId(initialDatabaseId)}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#c9d1d9]">Label</span>
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={initialLabel}
          spellCheck={false}
          autoComplete="off"
          className="rounded-md border border-[#30363d] bg-[#0f1117] px-3 py-2 text-sm text-[#e6edf3] placeholder:text-[#484f58] outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-red-950/40 px-3 py-2 font-mono text-xs text-red-300">
          {error}
        </p>
      )}

      <FormActions
        required={required}
        saving={saving}
        onClose={onClose}
        submitLabel="Save Changes"
        disabled={saving}
      />
    </form>
  );
}

function FormActions({
  required,
  saving,
  onClose,
  submitLabel,
  disabled,
}: {
  required: boolean;
  saving: boolean;
  onClose: () => void;
  submitLabel: string;
  disabled: boolean;
}) {
  return (
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
        disabled={disabled}
        className="rounded-md bg-[#f97316] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </div>
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
