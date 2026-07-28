"use client";

import { useEffect, useRef, useState } from "react";
import type { ExportFormat } from "@/lib/export-data";

const FORMATS: { format: ExportFormat; label: string; description: string }[] = [
  { format: "xlsx", label: "Excel", description: ".xlsx" },
  { format: "json", label: "JSON", description: ".json" },
  { format: "csv", label: "CSV", description: ".csv" },
];

interface ExportDropdownProps {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
}

export function ExportDropdown({ onExport, disabled = false }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSelect = (format: ExportFormat) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs font-medium text-[#c9d1d9] transition-colors hover:border-[#484f58] hover:bg-[#30363d] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <DownloadIcon />
        Export
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[140px] overflow-hidden rounded-md border border-[#30363d] bg-[#161b22] py-1 shadow-xl"
        >
          {FORMATS.map(({ format, label, description }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(format)}
              className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-xs transition-colors hover:bg-[#21262d]"
            >
              <span className="font-medium text-[#c9d1d9]">{label}</span>
              <span className="font-mono text-[10px] text-[#484f58]">{description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 1v6M3.5 4.5 6 7l2.5-2.5M2 9.5h8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2 3.5 5 6.5 8 3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
