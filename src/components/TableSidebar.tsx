"use client";

import type { SavedConnection } from "@/types/d1";
import { truncateId } from "@/types/d1";

interface TableSidebarProps {
  connections: SavedConnection[];
  connectionsLoading: boolean;
  activeConnectionId: string | null;
  onSelectConnection: (id: string) => void;
  onSyncConnections: () => void;
  onEditConnection: (id: string) => void;
  tables: string[];
  tablesLoading: boolean;
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  onRefreshTables: () => void;
}

export function TableSidebar({
  connections,
  connectionsLoading,
  activeConnectionId,
  onSelectConnection,
  onSyncConnections,
  onEditConnection,
  tables,
  tablesLoading,
  selectedTable,
  onSelectTable,
  onRefreshTables,
}: TableSidebarProps) {
  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[#30363d] bg-[#161b22] lg:w-72">
      <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
          Databases
        </h2>
        <button
          type="button"
          onClick={onSyncConnections}
          disabled={connectionsLoading}
          aria-label="Refresh databases from Cloudflare"
          className="rounded p-1 text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-[#f97316] disabled:opacity-40"
        >
          <RefreshIcon spinning={connectionsLoading} />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto border-b border-[#30363d] py-1">
        {connectionsLoading && connections.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-[#484f58]">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#30363d] border-t-[#f97316]" />
            Loading databases…
          </div>
        ) : connections.length === 0 ? (
          <p className="px-4 py-4 text-xs text-[#484f58]">No D1 databases found</p>
        ) : (
          <ul>
            {connections.map((connection) => (
              <li key={connection.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectConnection(connection.id)}
                  className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors ${
                    activeConnectionId === connection.id
                      ? "bg-[#f97316]/10"
                      : "hover:bg-[#21262d]"
                  }`}
                >
                  <span
                    className={`truncate text-xs font-medium ${
                      activeConnectionId === connection.id
                        ? "text-[#f97316]"
                        : "text-[#c9d1d9]"
                    }`}
                  >
                    {connection.label}
                  </span>
                  <span className="truncate font-mono text-[10px] text-[#484f58]">
                    {truncateId(connection.databaseId)}
                  </span>
                  <span className="truncate font-mono text-[10px] text-[#484f58]">
                    acct {truncateId(connection.accountId, 6, 4)}
                  </span>
                </button>
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditConnection(connection.id);
                    }}
                    aria-label={`Rename ${connection.label}`}
                    className="rounded p-1 text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9]"
                  >
                    <EditIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
          Tables
        </h2>
        <button
          type="button"
          onClick={onRefreshTables}
          disabled={tablesLoading || !activeConnection}
          aria-label="Refresh tables"
          className="rounded p-1 text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-[#f97316] disabled:opacity-40"
        >
          <RefreshIcon spinning={tablesLoading} />
        </button>
      </div>

      {activeConnection && (
        <div className="border-b border-[#30363d] px-4 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#484f58]">Active</p>
          <p className="mt-0.5 truncate text-xs text-[#8b949e]">{activeConnection.label}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {!activeConnection ? (
          <p className="px-4 py-6 text-xs text-[#484f58]">Select a database</p>
        ) : tablesLoading && tables.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-[#484f58]">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#30363d] border-t-[#f97316]" />
            Loading tables…
          </div>
        ) : tables.length === 0 ? (
          <p className="px-4 py-6 text-xs text-[#484f58]">No tables found</p>
        ) : (
          <ul>
            {tables.map((table) => (
              <li key={table}>
                <button
                  type="button"
                  onClick={() => onSelectTable(table)}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left font-mono text-xs transition-colors ${
                    selectedTable === table
                      ? "bg-[#f97316]/10 text-[#f97316]"
                      : "text-[#c9d1d9] hover:bg-[#21262d]"
                  }`}
                >
                  <TableIcon />
                  <span className="truncate">{table}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M7.5 2.5 9.5 4.5 4 10H2v-2L7.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      className="shrink-0 opacity-60"
      aria-hidden="true"
    >
      <rect x="1" y="2" width="10" height="8" rx="1" />
      <path d="M1 5h10M4 5v5M8 5v5" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      className={spinning ? "animate-spin" : ""}
      aria-hidden="true"
    >
      <path d="M11.5 7A4.5 4.5 0 1 1 7 2.5" />
      <path d="M7 1v2.5H9.5" />
    </svg>
  );
}
