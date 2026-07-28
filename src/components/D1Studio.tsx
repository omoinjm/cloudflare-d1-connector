"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConnectionModal,
  type ConnectionModalMode,
} from "@/components/ConnectionModal";
import { DataGrid } from "@/components/DataGrid";
import { ErrorBanner } from "@/components/ErrorBanner";
import { QueryEditor } from "@/components/QueryEditor";
import { StatusBar } from "@/components/StatusBar";
import { TableSidebar } from "@/components/TableSidebar";
import {
  loadConnections,
  removeConnection,
  setActiveConnection,
  upsertConnection,
} from "@/lib/connection-storage";
import {
  buildTableQuery,
  executeD1Query,
  extractColumns,
  fetchTables,
  parseQueryResults,
  validateConfig,
} from "@/lib/d1-api";
import { exportData, type ExportFormat } from "@/lib/export-data";
import type { ConnectionInstance, D1Config, StorageMode } from "@/types/d1";

const EMPTY_CONFIG: D1Config = {
  accountId: "",
  databaseId: "",
  apiToken: "",
};

export function D1Studio() {
  const [connections, setConnections] = useState<ConnectionInstance[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ConnectionModalMode>("add");
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<D1Config>(EMPTY_CONFIG);
  const [modalLabel, setModalLabel] = useState("");
  const [modalStorageMode, setModalStorageMode] = useState<StorageMode>("session");
  const [modalRequired, setModalRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  const connected = connections.length > 0 && activeConnection !== null;

  const resetQueryResults = useCallback(() => {
    setSql("-- Select a table or write a query");
    setRows([]);
    setColumns([]);
    setExecutionTimeMs(null);
    setRowCount(0);
    setSelectedTable(null);
  }, []);

  const openAddModal = useCallback((required = false) => {
    setModalMode("add");
    setEditingConnectionId(null);
    setModalConfig(EMPTY_CONFIG);
    setModalLabel("");
    setModalStorageMode("session");
    setModalError(null);
    setModalRequired(required);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback(
    (id: string) => {
      const connection = connections.find((c) => c.id === id);
      if (!connection) return;

      setModalMode("edit");
      setEditingConnectionId(id);
      setModalConfig(connection.config);
      setModalLabel(connection.label);
      setModalStorageMode(connection.mode);
      setModalError(null);
      setModalRequired(false);
      setModalOpen(true);
    },
    [connections],
  );

  const loadTables = useCallback(async (instance: ConnectionInstance) => {
    setTablesLoading(true);
    try {
      const tableNames = await fetchTables(instance.config);
      setTables(tableNames);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load tables";
      setError(message);
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  const refreshConnections = useCallback(async () => {
    const { connections: loaded, activeId } = await loadConnections();
    setConnections(loaded);
    setActiveConnectionId(activeId);
    return { loaded, activeId };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const { loaded, activeId } = await refreshConnections();
      if (cancelled) return;

      if (loaded.length === 0) {
        openAddModal(true);
      } else if (activeId) {
        const active = loaded.find((c) => c.id === activeId);
        if (active) await loadTables(active);
      }

      setHydrated(true);
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [loadTables, refreshConnections, openAddModal]);

  const runQuery = useCallback(
    async (activeConfig: D1Config, query: string) => {
      const configError = validateConfig(activeConfig);
      if (configError) {
        setError(configError);
        return;
      }

      if (!query.trim() || query.trim().startsWith("--")) {
        setError("SQL query cannot be empty");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await executeD1Query(activeConfig, query);

        if (!data.success) {
          const apiError =
            data.errors?.[0]?.message ??
            data.result?.[0]?.error ??
            "Query failed";
          throw new Error(apiError);
        }

        const { rows: resultRows, executionTimeMs: timeMs } =
          parseQueryResults(data);
        const resultColumns = extractColumns(resultRows);

        setRows(resultRows);
        setColumns(resultColumns);
        setExecutionTimeMs(timeMs);
        setRowCount(resultRows.length);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
        setRows([]);
        setColumns([]);
        setExecutionTimeMs(null);
        setRowCount(0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleExecute = useCallback(() => {
    if (!activeConnection) return;
    runQuery(activeConnection.config, sql);
  }, [activeConnection, sql, runQuery]);

  const handleSaveConnection = useCallback(
    async (newConfig: D1Config, mode: StorageMode, label: string) => {
      const configError = validateConfig(newConfig);
      if (configError) {
        setModalError(configError);
        return;
      }

      setSaving(true);
      setModalError(null);

      try {
        await fetchTables(newConfig);
        const instance = await upsertConnection(
          newConfig,
          mode,
          label,
          editingConnectionId ?? undefined,
        );

        const { loaded, activeId } = await refreshConnections();
        const active = loaded.find((c) => c.id === (activeId ?? instance.id)) ?? instance;

        setActiveConnectionId(active.id);
        setActiveConnection(active.id);
        setModalOpen(false);
        setModalRequired(false);
        resetQueryResults();
        await loadTables(active);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to connect";
        setModalError(message);
      } finally {
        setSaving(false);
      }
    },
    [editingConnectionId, loadTables, refreshConnections, resetQueryResults],
  );

  const handleSelectConnection = useCallback(
    async (id: string) => {
      if (id === activeConnectionId) return;

      const connection = connections.find((c) => c.id === id);
      if (!connection) return;

      setActiveConnectionId(id);
      setActiveConnection(id);
      resetQueryResults();
      await loadTables(connection);
    },
    [activeConnectionId, connections, loadTables, resetQueryResults],
  );

  const handleRemoveConnection = useCallback(
    async (id: string) => {
      const nextActiveId = removeConnection(id);
      const { loaded } = await refreshConnections();

      if (loaded.length === 0) {
        setActiveConnectionId(null);
        setTables([]);
        resetQueryResults();
        openAddModal(true);
        return;
      }

      const nextId =
        nextActiveId ??
        (activeConnectionId === id ? loaded[0]?.id ?? null : activeConnectionId);

      setActiveConnectionId(nextId);
      if (nextId) {
        setActiveConnection(nextId);
        const next = loaded.find((c) => c.id === nextId);
        if (next) {
          resetQueryResults();
          await loadTables(next);
        }
      }
    },
    [activeConnectionId, loadTables, openAddModal, refreshConnections, resetQueryResults],
  );

  const handleSelectTable = useCallback(
    (tableName: string) => {
      if (!activeConnection) return;
      const query = buildTableQuery(tableName);
      setSelectedTable(tableName);
      setSql(query);
      runQuery(activeConnection.config, query);
    },
    [activeConnection, runQuery],
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      try {
        exportData(format, rows, columns);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to export data";
        setError(message);
      }
    },
    [rows, columns],
  );

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f1117] text-sm text-[#484f58]">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#30363d] border-t-[#f97316]" />
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
              {connections.length} database{connections.length === 1 ? "" : "s"} connected
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAddModal(false)}
          className="rounded-md border border-[#30363d] px-3 py-1.5 text-xs font-medium text-[#c9d1d9] transition-colors hover:border-[#484f58] hover:bg-[#21262d]"
        >
          Add Connection
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {connections.length > 0 && (
          <TableSidebar
            connections={connections}
            activeConnectionId={activeConnectionId}
            onSelectConnection={handleSelectConnection}
            onAddConnection={() => openAddModal(false)}
            onEditConnection={openEditModal}
            onRemoveConnection={handleRemoveConnection}
            tables={tables}
            tablesLoading={tablesLoading}
            selectedTable={selectedTable}
            onSelectTable={handleSelectTable}
            onRefreshTables={() => {
              if (activeConnection) loadTables(activeConnection);
            }}
          />
        )}

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

      <ConnectionModal
        open={modalOpen}
        mode={modalMode}
        initialConfig={modalConfig}
        initialLabel={modalLabel}
        initialStorageMode={modalStorageMode}
        onSave={handleSaveConnection}
        onClose={() => setModalOpen(false)}
        saving={saving}
        error={modalError}
        required={modalRequired}
      />
    </div>
  );
}

function CloudflareLogo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f97316]/10">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#f97316" aria-hidden="true">
        <path d="M16.5 9.5c-.3-2.1-2.1-3.7-4.3-3.7-1.4 0-2.6.7-3.4 1.7C7.9 7.3 7 7 6.1 7 4.3 7 2.8 8.3 2.4 10c-1.5.3-2.6 1.6-2.6 3.2 0 1.8 1.5 3.3 3.3 3.3h14.4c1.8 0 3.3-1.5 3.3-3.3 0-1.7-1.3-3.1-3-3.3-.2-2.2-2-3.9-4.3-3.9-.5 0-1 .1-1.4.2Z" />
      </svg>
    </div>
  );
}
