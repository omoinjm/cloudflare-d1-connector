import type { D1ApiResponse, D1Config } from "@/types/d1";

export const D1_QUERY_ENDPOINT =
  "https://api.cloudflare.com/client/v4/accounts/{accountId}/d1/database/{databaseId}/query";

export function buildD1QueryUrl(config: Pick<D1Config, "accountId" | "databaseId">): string {
  return D1_QUERY_ENDPOINT.replace("{accountId}", config.accountId.trim()).replace(
    "{databaseId}",
    config.databaseId.trim(),
  );
}

export async function executeD1Query(
  config: D1Config,
  sql: string,
): Promise<D1ApiResponse> {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: config.accountId.trim(),
      databaseId: config.databaseId.trim(),
      apiToken: config.apiToken.trim(),
      sql: sql.trim(),
    }),
  });

  const data = (await response.json()) as D1ApiResponse & { error?: string };

  if (!response.ok) {
    const message =
      data.errors?.[0]?.message ??
      data.error ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

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

export function validateConfig(config: D1Config): string | null {
  if (!config.accountId.trim()) return "Account ID is required";
  if (!config.databaseId.trim()) return "Database ID is required";
  if (!config.apiToken.trim()) return "API Token is required";
  return null;
}

const TABLES_SQL = `
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
  AND name NOT LIKE '_cf_%'
ORDER BY name;
`.trim();

export async function fetchTables(config: D1Config): Promise<string[]> {
  const data = await executeD1Query(config, TABLES_SQL);

  if (!data.success) {
    const apiError =
      data.errors?.[0]?.message ?? data.result?.[0]?.error ?? "Failed to fetch tables";
    throw new Error(apiError);
  }

  const { rows } = parseQueryResults(data);
  return rows
    .map((row) => String(row.name ?? ""))
    .filter(Boolean);
}

export function buildTableQuery(tableName: string): string {
  const escaped = tableName.replace(/"/g, '""');
  return `SELECT * FROM "${escaped}" LIMIT 100;`;
}
