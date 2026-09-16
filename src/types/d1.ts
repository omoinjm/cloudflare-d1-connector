export interface SavedConnection {
  id: string;
  label: string;
  accountId: string;
  databaseId: string;
  savedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface CfAccountOption {
  id: string;
  name: string;
}

export interface CfDatabaseOption {
  uuid: string;
  name: string;
}

export interface D1QueryMeta {
  duration?: number;
  changes?: number;
  rows_read?: number;
  rows_written?: number;
  last_row_id?: number;
  changed_db?: boolean;
  size_after?: number;
  served_by?: string;
}

export interface D1QueryResultItem {
  results: Record<string, unknown>[];
  success: boolean;
  meta?: D1QueryMeta;
  error?: string;
}

export interface D1ApiResponse {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: string[];
  result: D1QueryResultItem[];
}

export interface QueryRequestBody {
  connectionId: string;
  sql: string;
}

export function defaultConnectionLabel(config: Pick<SavedConnection, "databaseId">): string {
  const id = config.databaseId.trim();
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function truncateId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export interface TableColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: unknown;
  primaryKey: number;
}

export const ROWID_COLUMN = "__d1_rowid__";
