export interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export type StorageMode = "local" | "session";

/** Public connection record (credentials decrypted in memory only). */
export interface ConnectionInstance {
  id: string;
  label: string;
  config: D1Config;
  fingerprint: string;
  mode: StorageMode;
  savedAt: string;
}

/** Persisted connection record (token encrypted). */
export interface StoredConnectionRecord {
  id: string;
  label: string;
  accountId: string;
  databaseId: string;
  encryptedToken: string;
  fingerprint: string;
  mode: StorageMode;
  savedAt: string;
}

export interface ConnectionStore {
  activeId: string | null;
  connections: StoredConnectionRecord[];
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

export interface QueryState {
  rows: Record<string, unknown>[];
  columns: string[];
  executionTimeMs: number | null;
  rowCount: number;
  error: string | null;
  loading: boolean;
}

export interface QueryRequestBody {
  accountId: string;
  databaseId: string;
  apiToken: string;
  sql: string;
}

export function defaultConnectionLabel(config: Pick<D1Config, "databaseId">): string {
  const id = config.databaseId.trim();
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function truncateId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
