"use client";

import { ExportDropdown } from "@/components/ExportDropdown";
import type { ExportFormat } from "@/lib/export-data";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onExport: (format: ExportFormat) => void;
  loading: boolean;
  canExport: boolean;
  disabled?: boolean;
}

export function QueryEditor({
  value,
  onChange,
  onExecute,
  onExport,
  loading,
  canExport,
  disabled = false,
}: QueryEditorProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onExecute();
    }
  };

  return (
    <div className="flex flex-col border-b border-[#30363d]">
      <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
          SQL Query
        </span>
        <div className="flex items-center gap-2">
          <ExportDropdown
            onExport={onExport}
            disabled={!canExport || disabled}
          />
          <button
            type="button"
            onClick={onExecute}
            disabled={loading || disabled}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#f97316] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Running…
              </>
            ) : (
              <>
                <PlayIcon />
                Execute Query
              </>
            )}
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="SELECT * FROM users LIMIT 100;"
        spellCheck={false}
        rows={8}
        disabled={disabled}
        className="w-full resize-y bg-[#0f1117] px-4 py-3 font-mono text-sm leading-relaxed text-[#e6edf3] placeholder:text-[#484f58] outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="border-t border-[#30363d] bg-[#161b22] px-4 py-1">
        <span className="text-[11px] text-[#484f58]">
          Tip: Press <kbd className="rounded border border-[#30363d] px-1 font-mono">Ctrl</kbd>+
          <kbd className="rounded border border-[#30363d] px-1 font-mono">Enter</kbd> to run
        </span>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M2.5 1.5v9l7-4.5-7-4.5z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path
        d="M10.5 6a4.5 4.5 0 0 0-4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
