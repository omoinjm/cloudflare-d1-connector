"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isAutoIncrementPrimaryKey,
  parseCellInput,
} from "@/lib/d1-api";
import type { TableColumnInfo } from "@/types/d1";

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDefaultHint(column: TableColumnInfo, schema: TableColumnInfo[]): string {
  if (isAutoIncrementPrimaryKey(column, schema)) return "auto";
  if (column.defaultValue !== null && column.defaultValue !== undefined) {
    return `default: ${String(column.defaultValue)}`;
  }
  if (!column.notNull) return "nullable";
  return "required";
}

interface DataGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  loading: boolean;
  editable?: boolean;
  schema?: TableColumnInfo[];
  mutating?: boolean;
  onCellUpdate?: (
    rowIndex: number,
    column: string,
    value: unknown,
  ) => Promise<void>;
  onRowInsert?: (values: Record<string, unknown>) => Promise<void>;
}

interface EditingCell {
  rowIndex: number;
  column: string;
  value: string;
}

export function DataGrid({
  columns,
  rows,
  loading,
  editable = false,
  schema = [],
  mutating = false,
  onCellUpdate,
  onRowInsert,
}: DataGridProps) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
  const [cellError, setCellError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayColumns = columns;
  const schemaByName = useMemoMap(schema);

  const isAutoPk = useCallback(
    (column: string) => {
      const info = schemaByName.get(column);
      return info ? isAutoIncrementPrimaryKey(info, schema) : false;
    },
    [schema, schemaByName],
  );

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setCellError(null);
  }, []);

  const startEdit = useCallback(
    (rowIndex: number, column: string) => {
      if (!editable || mutating) return;
      const columnInfo = schemaByName.get(column);
      if (columnInfo && isAutoIncrementPrimaryKey(columnInfo, schema)) {
        return;
      }
      setCellError(null);
      setEditing({
        rowIndex,
        column,
        value: formatCellValue(rows[rowIndex]?.[column]).replace(/^NULL$/, ""),
      });
    },
    [editable, mutating, rows, schema, schemaByName],
  );

  const commitEdit = useCallback(async () => {
    if (!editing || !onCellUpdate) return;

    const columnInfo = schemaByName.get(editing.column);
    if (!columnInfo) return;

    const original = rows[editing.rowIndex]?.[editing.column];
    let parsed: unknown;

    try {
      parsed = parseCellInput(editing.value, columnInfo);
    } catch (err) {
      setCellError(err instanceof Error ? err.message : "Invalid value");
      return;
    }

    const originalDisplay = original === null || original === undefined ? null : original;
    const parsedDisplay = parsed === null || parsed === undefined ? null : parsed;

    if (String(originalDisplay) === String(parsedDisplay)) {
      cancelEdit();
      return;
    }

    try {
      await onCellUpdate(editing.rowIndex, editing.column, parsed);
      cancelEdit();
    } catch (err) {
      setCellError(err instanceof Error ? err.message : "Failed to save");
    }
  }, [cancelEdit, editing, onCellUpdate, rows, schemaByName]);

  const startAddRow = useCallback(() => {
    if (!editable || mutating) return;
    setCellError(null);
    setAddingRow(true);
    setNewRowValues({});
  }, [editable, mutating]);

  const cancelAddRow = useCallback(() => {
    setAddingRow(false);
    setNewRowValues({});
    setCellError(null);
  }, []);

  const commitAddRow = useCallback(async () => {
    if (!onRowInsert) return;

    const values: Record<string, unknown> = {};

    try {
      for (const column of schema) {
        const raw = newRowValues[column.name];
        if (raw === undefined || raw.trim() === "") continue;
        values[column.name] = parseCellInput(raw, column);
      }
      await onRowInsert(values);
      cancelAddRow();
    } catch (err) {
      setCellError(err instanceof Error ? err.message : "Failed to insert row");
    }
  }, [cancelAddRow, newRowValues, onRowInsert, schema]);

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
    <div className="flex min-h-0 flex-1 flex-col">
      {editable && (
        <div className="flex shrink-0 items-center justify-between border-b border-[#30363d] bg-[#161b22] px-4 py-2">
          <span className="text-[11px] text-[#8b949e]">
            Double-click a cell to edit ·{" "}
            {mutating ? "Saving…" : "Changes save on Enter or blur"}
          </span>
          <button
            type="button"
            onClick={addingRow ? cancelAddRow : startAddRow}
            disabled={mutating}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#30363d] px-3 py-1 text-xs font-medium text-[#c9d1d9] transition-colors hover:border-[#484f58] hover:bg-[#21262d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addingRow ? (
              "Cancel"
            ) : (
              <>
                <PlusIcon />
                Add row
              </>
            )}
          </button>
        </div>
      )}

      {cellError && (
        <div className="shrink-0 border-b border-red-900/50 bg-red-950/30 px-4 py-2 text-xs text-red-300">
          {cellError}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table
          className="w-full table-fixed border-collapse text-sm"
          style={{ minWidth: `${Math.max(displayColumns.length * 10, 40)}rem` }}
        >
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#161b22]">
              {displayColumns.map((col) => (
                <th
                  key={col}
                  className="overflow-hidden border-b border-r border-[#30363d] px-4 py-2.5 text-left font-mono text-xs font-semibold uppercase tracking-wide text-[#f97316] last:border-r-0"
                >
                  <span className="block truncate" title={col}>
                    {col}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !addingRow ? (
              <tr>
                <td
                  colSpan={displayColumns.length}
                  className="px-4 py-8 text-center text-[#484f58]"
                >
                  {editable ? "No rows — click Add row to insert one" : "Query returned no rows"}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-[#21262d] transition-colors hover:bg-[#161b22]/80"
                >
                  {displayColumns.map((col) => {
                    const isEditing =
                      editing?.rowIndex === rowIndex && editing.column === col;
                    const columnInfo = schemaByName.get(col);
                    const isPkAuto = isAutoPk(col);

                    const cellValue = formatCellValue(row[col]);

                    return (
                      <td
                        key={col}
                        className={`overflow-hidden border-r border-[#21262d] px-4 py-2 font-mono text-xs last:border-r-0 ${
                          editable && !isPkAuto
                            ? "cursor-text hover:bg-[#21262d]/60"
                            : ""
                        } ${isPkAuto ? "text-[#484f58]" : "text-[#c9d1d9]"}`}
                        onDoubleClick={() => startEdit(rowIndex, col)}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={editing.value}
                            onChange={(e) =>
                              setEditing({ ...editing, value: e.target.value })
                            }
                            onBlur={() => void commitEdit()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitEdit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            disabled={mutating}
                            className="w-full min-w-[8rem] rounded border border-[#f97316]/50 bg-[#0f1117] px-2 py-1 text-xs text-[#e6edf3] outline-none focus:border-[#f97316]"
                          />
                        ) : (
                          <span className="block truncate" title={cellValue}>
                            {cellValue}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}

            {addingRow && (
              <tr className="border-b border-[#21262d] bg-[#161b22]/60">
                {displayColumns.map((col) => {
                  const columnInfo = schemaByName.get(col);
                  const isPkAuto = isAutoPk(col);

                  return (
                    <td
                      key={col}
                      className="border-r border-[#21262d] px-2 py-1.5 last:border-r-0"
                    >
                      {isPkAuto ? (
                        <span className="px-2 font-mono text-xs text-[#484f58]">
                          auto
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={newRowValues[col] ?? ""}
                          placeholder={columnInfo ? formatDefaultHint(columnInfo, schema) : col}
                          onChange={(e) =>
                            setNewRowValues((prev) => ({
                              ...prev,
                              [col]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitAddRow();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelAddRow();
                            }
                          }}
                          disabled={mutating}
                          className="w-full min-w-[6rem] rounded border border-[#30363d] bg-[#0f1117] px-2 py-1 font-mono text-xs text-[#e6edf3] placeholder:text-[#484f58] outline-none focus:border-[#f97316]/50"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addingRow && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#30363d] bg-[#161b22] px-4 py-2">
          <button
            type="button"
            onClick={cancelAddRow}
            disabled={mutating}
            className="rounded-md border border-[#30363d] px-3 py-1 text-xs text-[#8b949e] hover:bg-[#21262d] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void commitAddRow()}
            disabled={mutating}
            className="rounded-md bg-[#f97316] px-3 py-1 text-xs font-semibold text-white hover:bg-[#ea580c] disabled:opacity-50"
          >
            {mutating ? "Inserting…" : "Insert row"}
          </button>
        </div>
      )}
    </div>
  );
}

function useMemoMap(schema: TableColumnInfo[]): Map<string, TableColumnInfo> {
  const map = new Map<string, TableColumnInfo>();
  for (const column of schema) {
    map.set(column.name, column);
  }
  return map;
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

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
