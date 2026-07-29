"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DatabasePickerModal } from "@/components/DatabasePickerModal";
import { DataGrid } from "@/components/DataGrid";
import { ErrorBanner } from "@/components/ErrorBanner";
import { QueryEditor } from "@/components/QueryEditor";
import { StatusBar } from "@/components/StatusBar";
import { TableSidebar } from "@/components/TableSidebar";
import {
  buildTableQuery,
  extractColumns,
  fetchTables,
  parseQueryResults,
  validateSql,
} from "@/lib/d1-api";
import { exportData, type ExportFormat } from "@/lib/export-data";
import {
  executeQuery,
  fetchAuthState,
  setActiveConnection,
  signInWithCloudflare,
  signOut,
  syncConnections,
  updateConnectionLabel,
} from "@/lib/studio-api";
import type { AuthUser, SavedConnection } from "@/types/d1";

export function D1Studio() {
  const [hydrated, setHydrated] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [modalLabel, setModalLabel] = useState("");
  const [modalAccountId, setModalAccountId] = useState("");
  const [modalDatabaseId, setModalDatabaseId] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const [sql, setSql] = useState("-- Select a table or write a query");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConnection = useMemo(
    () => connections.find((c) => c.id === activeConnectionId) ?? null,
    [connections, activeConnectionId],
  );

  const connected = authenticated && connections.length > 0 && activeConnection !== null;

  const resetQueryResults = useCallback(() => {
    setSql("-- Select a table or write a query");
    setRows([]);
    setColumns([]);
    setExecutionTimeMs(null);
    setRowCount(0);
    setSelectedTable(null);
  }, []);

  const refreshConnections = useCallback(async () => {
    setConnectionsLoading(true);
    try {
      const { connections: loaded, activeId } = await syncConnections();
      setConnections(loaded);
      setActiveConnectionId(activeId);
      return { loaded, activeId };
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  const loadTables = useCallback(async (connectionId: string) => {
    setTablesLoading(true);
    try {
      const tableNames = await fetchTables(connectionId);
      setTables(tableNames);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load tables";
      setError(message);
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      if (authError) {
        setError(decodeURIComponent(authError));
        window.history.replaceState({}, "", window.location.pathname);
      }

      try {
        const auth = await fetchAuthState();
        if (cancelled) return;

        setAuthenticated(auth.authenticated);
        setUser(auth.user);

        if (auth.authenticated) {
          const { loaded, activeId } = await refreshConnections();
          if (activeId) {
            await loadTables(activeId);
          } else if (loaded.length === 0) {
            setError("No D1 databases found in your Cloudflare account.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load app state");
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [loadTables, refreshConnections]);

  const openEditModal = useCallback(
    (id: string) => {
      const connection = connections.find((c) => c.id === id);
      if (!connection) return;

      setEditingConnectionId(id);
      setModalLabel(connection.label);
      setModalAccountId(connection.accountId);
      setModalDatabaseId(connection.databaseId);
      setModalError(null);
      setModalOpen(true);
    },
    [connections],
  );

  const handleSyncConnections = useCallback(async () => {
    const previousActiveId = activeConnectionId;
    const { loaded, activeId } = await refreshConnections();
    const nextActiveId =
      (previousActiveId && loaded.some((c) => c.id === previousActiveId)
        ? previousActiveId
        : activeId) ?? null;

    if (nextActiveId && nextActiveId !== activeConnectionId) {
      setActiveConnectionId(nextActiveId);
      await setActiveConnection(nextActiveId);
    }

    if (nextActiveId) {
      resetQueryResults();
      await loadTables(nextActiveId);
    } else {
      setTables([]);
      resetQueryResults();
      if (loaded.length === 0) {
        setError("No D1 databases found in your Cloudflare account.");
      }
    }
  }, [activeConnectionId, loadTables, refreshConnections, resetQueryResults]);

  const runQuery = useCallback(async (connectionId: string, query: string) => {
    const sqlError = validateSql(query);
    if (sqlError) {
      setError(sqlError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await executeQuery(connectionId, query);

      if (!data.success) {
        const apiError =
          data.errors?.[0]?.message ?? data.result?.[0]?.error ?? "Query failed";
        throw new Error(apiError);
      }

      const { rows: resultRows, executionTimeMs: timeMs } = parseQueryResults(data);
      const resultColumns = extractColumns(resultRows);

      setRows(resultRows);
      setColumns(resultColumns);
      setExecutionTimeMs(timeMs);
      setRowCount(resultRows.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setRows([]);
      setColumns([]);
      setExecutionTimeMs(null);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExecute = useCallback(() => {
    if (!activeConnection) return;
    runQuery(activeConnection.id, sql);
  }, [activeConnection, sql, runQuery]);

  const handleSaveConnection = useCallback(
    async (input: { accountId: string; databaseId: string; label: string }) => {
      if (!editingConnectionId) return;

      setSaving(true);
      setModalError(null);

      try {
        const updated = await updateConnectionLabel(editingConnectionId, input.label);
        setConnections((prev) =>
          prev.map((connection) => (connection.id === updated.id ? updated : connection)),
        );
        setModalOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save connection";
        setModalError(message);
      } finally {
        setSaving(false);
      }
    },
    [editingConnectionId],
  );

  const handleSelectConnection = useCallback(
    async (id: string) => {
      if (id === activeConnectionId) return;

      setActiveConnectionId(id);
      await setActiveConnection(id);
      resetQueryResults();
      await loadTables(id);
    },
    [activeConnectionId, loadTables, resetQueryResults],
  );

  const handleSelectTable = useCallback(
    (tableName: string) => {
      if (!activeConnection) return;
      const query = buildTableQuery(tableName);
      setSelectedTable(tableName);
      setSql(query);
      runQuery(activeConnection.id, query);
    },
    [activeConnection, runQuery],
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      try {
        exportData(format, rows, columns);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to export data";
        setError(message);
      }
    },
    [rows, columns],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    setAuthenticated(false);
    setUser(null);
    setConnections([]);
    setActiveConnectionId(null);
    setTables([]);
    resetQueryResults();
  }, [resetQueryResults]);

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f1117] text-sm text-[#484f58]">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#30363d] border-t-[#f97316]" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0f1117] px-4">
        <div className="w-full max-w-sm rounded-lg border border-[#30363d] bg-[#161b22] p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f97316]/10">
            <CloudflareLogo large />
          </div>
          <h2 className="text-sm font-semibold text-[#e6edf3]">Sign in to D1 Studio</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#8b949e]">
            Connect with your Cloudflare account to browse D1 databases and run SQL from any
            device.
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-md bg-red-950/40 px-3 py-2 font-mono text-xs text-red-300">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={signInWithCloudflare}
            className="mt-5 w-full rounded-md bg-[#f97316] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c]"
          >
            Sign in with Cloudflare
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[#30363d] bg-[#0f1117] px-4 py-3">
        <div className="flex items-center gap-3">
          <CloudflareLogo />
          <div>
            <h1 className="text-sm font-semibold text-[#e6edf3]">D1 Studio</h1>
            <p className="text-[11px] text-[#484f58]">
              {user?.email || user?.name || "Signed in"} · {connections.length} database
              {connections.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-[#30363d] px-3 py-1.5 text-xs font-medium text-[#8b949e] transition-colors hover:border-[#484f58] hover:bg-[#21262d]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <TableSidebar
          connections={connections}
          connectionsLoading={connectionsLoading}
          activeConnectionId={activeConnectionId}
          onSelectConnection={handleSelectConnection}
          onSyncConnections={handleSyncConnections}
          onEditConnection={openEditModal}
          tables={tables}
          tablesLoading={tablesLoading}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
          onRefreshTables={() => {
            if (activeConnection) loadTables(activeConnection.id);
          }}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <QueryEditor
            value={sql}
            onChange={setSql}
            onExecute={handleExecute}
            onExport={handleExport}
            loading={loading}
            canExport={rows.length > 0 && !loading}
            disabled={!connected}
          />
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <StatusBar
            executionTimeMs={executionTimeMs}
            rowCount={rowCount}
            loading={loading}
          />
          <DataGrid columns={columns} rows={rows} loading={loading} />
        </main>
      </div>

      <DatabasePickerModal
        key={modalOpen ? editingConnectionId ?? "edit" : "closed"}
        open={modalOpen}
        mode="edit"
        initialLabel={modalLabel}
        initialAccountId={modalAccountId}
        initialDatabaseId={modalDatabaseId}
        onSave={handleSaveConnection}
        onClose={() => setModalOpen(false)}
        saving={saving}
        error={modalError}
      />
    </div>
  );
}

function CloudflareLogo({ large = false }: { large?: boolean }) {
  const size = large ? 24 : 18;
  return (
    <div
      className={`flex items-center justify-center rounded-md bg-[#f97316]/10 ${
        large ? "h-12 w-12" : "h-8 w-8"
      }`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#f97316" aria-hidden="true">
        <path d="M16.5 9.5c-.3-2.1-2.1-3.7-4.3-3.7-1.4 0-2.6.7-3.4 1.7C7.9 7.3 7 7 6.1 7 4.3 7 2.8 8.3 2.4 10c-1.5.3-2.6 1.6-2.6 3.2 0 1.8 1.5 3.3 3.3 3.3h14.4c1.8 0 3.3-1.5 3.3-3.3 0-1.7-1.3-3.1-3-3.3-.2-2.2-2-3.9-4.3-3.9-.5 0-1 .1-1.4.2Z" />
      </svg>
    </div>
  );
}
