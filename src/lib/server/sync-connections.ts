import { listAccounts, listD1Databases } from "@/lib/server/cf-api";
import { getUserById, updateUserConnections } from "@/lib/server/store";
import type { SavedConnection } from "@/types/d1";

function connectionKey(accountId: string, databaseId: string): string {
  return `${accountId}:${databaseId}`;
}

export async function syncConnectionsFromCloudflare(userId: string): Promise<{
  connections: SavedConnection[];
  activeId: string | null;
}> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const accounts = await listAccounts(userId);
  const existingByKey = new Map(
    user.connections.map((connection) => [
      connectionKey(connection.accountId, connection.databaseId),
      connection,
    ]),
  );

  const connections: SavedConnection[] = [];

  for (const account of accounts) {
    const databases = await listD1Databases(userId, account.id);
    for (const database of databases) {
      const key = connectionKey(account.id, database.uuid);
      const existing = existingByKey.get(key);
      const label =
        accounts.length > 1 ? `${account.name} / ${database.name}` : database.name;

      if (existing) {
        connections.push(existing);
      } else {
        connections.push({
          id: crypto.randomUUID(),
          label,
          accountId: account.id,
          databaseId: database.uuid,
          savedAt: new Date().toISOString(),
        });
      }
    }
  }

  connections.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  let activeId = user.activeConnectionId;
  if (!activeId || !connections.some((connection) => connection.id === activeId)) {
    activeId = connections[0]?.id ?? null;
  }

  await updateUserConnections(userId, connections, activeId);
  return { connections, activeId };
}
