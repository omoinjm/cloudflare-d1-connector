import type { D1ApiResponse, TableColumnInfo } from "@/types/d1";
import { ROWID_COLUMN } from "@/types/d1";
import { executeQuery } from "@/lib/studio-api";

export { ROWID_COLUMN };

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
  return Object.keys(rows[0]).filter((col) => col !== ROWID_COLUMN);
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

export function escapeSqlIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function tableHasRowid(
  connectionId: string,
  tableName: string,
): Promise<boolean> {
  const sql = `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ${escapeSqlString(tableName)};`;
  const data = await executeQuery(connectionId, sql);

  if (!data.success) return true;

  const { rows } = parseQueryResults(data);
  const createSql = String(rows[0]?.sql ?? "");
  return !/without\s+rowid/i.test(createSql);
}

export function formatSqlValue(value: unknown, column?: TableColumnInfo): string {
  if (value === null || value === undefined) return "NULL";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid number for ${column?.name ?? "column"}`);
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (typeof value === "object") {
    return escapeSqlString(JSON.stringify(value));
  }

  return escapeSqlString(String(value));
}

export function parseCellInput(input: string, column: TableColumnInfo): unknown {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed.toUpperCase() === "NULL") return null;

  const type = column.type.toUpperCase();

  if (type.includes("INT")) {
    const n = Number(trimmed);
    if (!Number.isInteger(n)) {
      throw new Error(`"${column.name}" expects an integer`);
    }
    return n;
  }

  if (type.includes("REAL") || type.includes("FLOA") || type.includes("DOUB")) {
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      throw new Error(`"${column.name}" expects a number`);
    }
    return n;
  }

  if (type.includes("BOOL")) {
    const lower = trimmed.toLowerCase();
    if (lower === "1" || lower === "true") return 1;
    if (lower === "0" || lower === "false") return 0;
    throw new Error(`"${column.name}" expects true/false or 1/0`);
  }

  return trimmed;
}

function buildWhereClause(
  row: Record<string, unknown>,
  schema: TableColumnInfo[],
): string {
  const pkColumns = schema
    .filter((c) => c.primaryKey > 0)
    .sort((a, b) => a.primaryKey - b.primaryKey);

  if (pkColumns.length > 0) {
    return pkColumns
      .map(
        (pk) =>
          `${escapeSqlIdentifier(pk.name)} = ${formatSqlValue(row[pk.name], pk)}`,
      )
      .join(" AND ");
  }

  if (row[ROWID_COLUMN] === undefined || row[ROWID_COLUMN] === null) {
    throw new Error("Cannot update row: no primary key or rowid available");
  }

  return `rowid = ${formatSqlValue(row[ROWID_COLUMN])}`;
}

export function buildTableQuery(tableName: string, hasRowid = true): string {
  const escaped = tableName.replace(/"/g, '""');
  if (!hasRowid) {
    return `SELECT * FROM "${escaped}" LIMIT 100;`;
  }
  return `SELECT *, rowid AS ${ROWID_COLUMN} FROM "${escaped}" LIMIT 100;`;
}

export function buildUpdateCellQuery(
  tableName: string,
  column: string,
  value: unknown,
  row: Record<string, unknown>,
  schema: TableColumnInfo[],
): string {
  const columnInfo = schema.find((c) => c.name === column);
  const table = escapeSqlIdentifier(tableName);
  const col = escapeSqlIdentifier(column);
  const where = buildWhereClause(row, schema);

  return `UPDATE ${table} SET ${col} = ${formatSqlValue(value, columnInfo)} WHERE ${where};`;
}

export function isAutoIncrementPrimaryKey(
  column: TableColumnInfo,
  schema: TableColumnInfo[],
): boolean {
  const pkColumns = schema.filter((c) => c.primaryKey > 0);
  return (
    pkColumns.length === 1 &&
    pkColumns[0].name === column.name &&
    column.type.toUpperCase().includes("INT")
  );
}

export function buildInsertQuery(
  tableName: string,
  values: Record<string, unknown>,
  schema: TableColumnInfo[],
): string {
  const insertColumns: TableColumnInfo[] = [];
  const sqlValues: string[] = [];

  for (const column of schema) {
    const raw = values[column.name];
    const hasValue = raw !== undefined && raw !== null && raw !== "";

    if (hasValue) {
      insertColumns.push(column);
      sqlValues.push(formatSqlValue(raw, column));
      continue;
    }

    if (isAutoIncrementPrimaryKey(column, schema)) {
      continue;
    }

    if (column.defaultValue !== null && column.defaultValue !== undefined) {
      continue;
    }

    if (!column.notNull) {
      insertColumns.push(column);
      sqlValues.push("NULL");
    }
  }

  if (insertColumns.length === 0) {
    throw new Error("Provide at least one column value to insert");
  }

  const table = escapeSqlIdentifier(tableName);
  const cols = insertColumns.map((c) => escapeSqlIdentifier(c.name)).join(", ");
  const vals = sqlValues.join(", ");

  return `INSERT INTO ${table} (${cols}) VALUES (${vals});`;
}

export async function fetchTableSchema(
  connectionId: string,
  tableName: string,
): Promise<TableColumnInfo[]> {
  const escaped = tableName.replace(/"/g, '""');
  const sql = `PRAGMA table_info("${escaped}")`;
  const data = await executeQuery(connectionId, sql);

  if (!data.success) {
    const apiError =
      data.errors?.[0]?.message ?? data.result?.[0]?.error ?? "Failed to fetch table schema";
    throw new Error(apiError);
  }

  const { rows } = parseQueryResults(data);

  return rows.map((row) => ({
    name: String(row.name ?? ""),
    type: String(row.type ?? "TEXT"),
    notNull: Number(row.notnull) === 1,
    defaultValue: row.dflt_value ?? null,
    primaryKey: Number(row.pk) || 0,
  }));
}

export function validateSql(sql: string): string | null {
  if (!sql.trim()) return "SQL query is required";
  if (sql.trim().startsWith("--")) return "SQL query cannot be empty";
  return null;
}
