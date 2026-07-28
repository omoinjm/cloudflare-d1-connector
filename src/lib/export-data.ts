import * as XLSX from "xlsx";

export type ExportFormat = "xlsx" | "json" | "csv";

const EXTENSIONS: Record<ExportFormat, string> = {
  xlsx: "xlsx",
  json: "json",
  csv: "csv",
};

export function formatExportFilename(format: ExportFormat, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `d1_export_${yyyy}-${mm}-${dd}_${hh}${min}${ss}.${EXTENSIONS[format]}`;
}

function assertHasData(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    throw new Error("No data to export. Run a query first.");
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function serializeCellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportToExcel(
  rows: Record<string, unknown>[],
  columns: string[],
  filename?: string,
): void {
  assertHasData(rows);

  const sheetData = rows.map((row) => {
    const record: Record<string, string | number | boolean | null> = {};
    for (const col of columns) {
      record[col] = serializeCellValue(row[col]);
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetData, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Query Results");

  XLSX.writeFile(workbook, filename ?? formatExportFilename("xlsx"));
}

export function exportToJson(
  rows: Record<string, unknown>[],
  filename?: string,
): void {
  assertHasData(rows);

  const json = JSON.stringify(rows, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, filename ?? formatExportFilename("json"));
}

export function exportToCsv(
  rows: Record<string, unknown>[],
  columns: string[],
  filename?: string,
): void {
  assertHasData(rows);

  const header = columns.map(escapeCsvCell).join(",");
  const body = rows
    .map((row) => columns.map((col) => escapeCsvCell(row[col])).join(","))
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename ?? formatExportFilename("csv"));
}

export function exportData(
  format: ExportFormat,
  rows: Record<string, unknown>[],
  columns: string[],
): void {
  switch (format) {
    case "xlsx":
      exportToExcel(rows, columns);
      break;
    case "json":
      exportToJson(rows);
      break;
    case "csv":
      exportToCsv(rows, columns);
      break;
  }
}
