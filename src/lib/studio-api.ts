import type {
  AuthUser,
  CfAccountOption,
  CfDatabaseOption,
  D1ApiResponse,
  SavedConnection,
} from "@/types/d1";

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed with status ${response.status}`);
  }
  return data;
}

export async function fetchAuthState(): Promise<{
  authenticated: boolean;
  user: AuthUser | null;
}> {
  const response = await fetch("/api/auth/me");
  const data = await parseJson<{
    authenticated: boolean;
    user?: AuthUser;
  }>(response);
  return {
    authenticated: data.authenticated,
    user: data.user ?? null,
  };
}

export function signInWithCloudflare(): void {
  window.location.href = "/api/auth/login";
}

export async function signOut(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  await parseJson(response);
}

export async function fetchConnections(): Promise<{
  connections: SavedConnection[];
  activeId: string | null;
}> {
  const response = await fetch("/api/connections");
  return parseJson(response);
}

export async function syncConnections(): Promise<{
  connections: SavedConnection[];
  activeId: string | null;
}> {
  const response = await fetch("/api/connections/sync", { method: "POST" });
  return parseJson(response);
}

export async function addConnection(input: {
  accountId: string;
  databaseId: string;
  label?: string;
}): Promise<{ connection: SavedConnection; activeId: string }> {
  const response = await fetch("/api/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function setActiveConnection(activeId: string | null): Promise<void> {
  const response = await fetch("/api/connections", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeId }),
  });
  await parseJson(response);
}

export async function updateConnectionLabel(id: string, label: string): Promise<SavedConnection> {
  const response = await fetch(`/api/connections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  const data = await parseJson<{ connection: SavedConnection }>(response);
  return data.connection;
}

export async function removeConnection(id: string): Promise<{
  activeId: string | null;
  connections: SavedConnection[];
}> {
  const response = await fetch(`/api/connections/${id}`, { method: "DELETE" });
  return parseJson(response);
}

export async function fetchAccounts(): Promise<CfAccountOption[]> {
  const response = await fetch("/api/d1/accounts");
  const data = await parseJson<{ accounts: CfAccountOption[] }>(response);
  return data.accounts;
}

export async function fetchDatabases(accountId: string): Promise<CfDatabaseOption[]> {
  const response = await fetch(
    `/api/d1/databases?accountId=${encodeURIComponent(accountId)}`,
  );
  const data = await parseJson<{ databases: CfDatabaseOption[] }>(response);
  return data.databases;
}

export async function executeQuery(
  connectionId: string,
  sql: string,
): Promise<D1ApiResponse> {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId, sql }),
  });

  const data = (await response.json()) as D1ApiResponse & { error?: string };
  if (!response.ok) {
    const message =
      data.errors?.[0]?.message ?? data.error ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data;
}
