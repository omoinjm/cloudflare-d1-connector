import type { D1ApiResponse } from "@/types/d1";
import { executeQuery } from "@/lib/studio-api";

export function parseQueryResults(data: D1ApiResponse): {
  rows: Record<string, unknown>[];
  executionTimeMs: number;
} {
  const firstResult = data.result?.[0];

  if (!firstResult) {
    return { rows: [], executionTimeMs: 0 };
  }

  if (!firstResult.success && firstResult.error) {
    throw new Error(firstResult.error);
  }

  const rows = firstResult.results ?? [];
  const durationSec = firstResult.meta?.duration ?? 0;
  const executionTimeMs = Math.round(durationSec * 1000);

  return { rows, executionTimeMs };
}

export function extractColumns(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

const TABLES_SQL = `
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
  AND name NOT LIKE '_cf_%'
ORDER BY name;
`.trim();

export async function fetchTables(connectionId: string): Promise<string[]> {
  const data = await executeQuery(connectionId, TABLES_SQL);

  if (!data.success) {
    const apiError =
      data.errors?.[0]?.message ?? data.result?.[0]?.error ?? "Failed to fetch tables";
    throw new Error(apiError);
  }

  const { rows } = parseQueryResults(data);
  return rows.map((row) => String(row.name ?? "")).filter(Boolean);
}

export function buildTableQuery(tableName: string): string {
  const escaped = tableName.replace(/"/g, '""');
  return `SELECT * FROM "${escaped}" LIMIT 100;`;
}

export function validateSql(sql: string): string | null {
  if (!sql.trim()) return "SQL query is required";
  if (sql.trim().startsWith("--")) return "SQL query cannot be empty";
  return null;
}
