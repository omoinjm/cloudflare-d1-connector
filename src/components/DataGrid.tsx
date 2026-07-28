"use client";

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface DataGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  loading: boolean;
}

export function DataGrid({ columns, rows, loading }: DataGridProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#8b949e]">
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#30363d] border-t-[#f97316]" />
          Executing query…
        </span>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-[#484f58]">
        <DatabaseIcon />
        <p>Run a query to see results</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#161b22]">
            {columns.map((col) => (
              <th
                key={col}
                className="border-b border-r border-[#30363d] px-4 py-2.5 text-left font-mono text-xs font-semibold uppercase tracking-wide text-[#f97316] last:border-r-0"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-[#484f58]"
              >
                Query returned no rows
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-[#21262d] transition-colors hover:bg-[#161b22]/80"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="max-w-xs truncate border-r border-[#21262d] px-4 py-2 font-mono text-xs text-[#c9d1d9] last:border-r-0"
                    title={formatCellValue(row[col])}
                  >
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DatabaseIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-[#30363d]"
      aria-hidden="true"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}
