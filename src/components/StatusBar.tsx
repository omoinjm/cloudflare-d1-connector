"use client";

interface StatusBarProps {
  executionTimeMs: number | null;
  rowCount: number;
  loading: boolean;
}

export function StatusBar({ executionTimeMs, rowCount, loading }: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 border-b border-[#30363d] bg-[#161b22] px-4 py-2 text-xs text-[#8b949e]">
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-[#c9d1d9]">Rows:</span>
        {loading ? "—" : rowCount.toLocaleString()}
      </span>
      <span className="h-3 w-px bg-[#30363d]" aria-hidden="true" />
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-[#c9d1d9]">Execution time:</span>
        {loading ? "—" : executionTimeMs !== null ? `${executionTimeMs} ms` : "—"}
      </span>
    </div>
  );
}
