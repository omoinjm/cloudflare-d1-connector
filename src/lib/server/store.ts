import {
  readStore,
  writeStore,
  type OAuthTokens,
  type StoredSession,
  type StoredUser,
} from "@/lib/server/store-backend";

export type { OAuthTokens, StoredSession, StoredUser };

export async function getUserById(userId: string): Promise<StoredUser | null> {
  const store = await readStore();
  return store.users[userId] ?? null;
}

export async function upsertUser(user: StoredUser): Promise<void> {
  const store = await readStore();
  store.users[user.id] = user;
  await writeStore(store);
}

export async function deleteUser(userId: string): Promise<void> {
  const store = await readStore();
  delete store.users[userId];
  for (const [sessionId, session] of Object.entries(store.sessions)) {
    if (session.userId === userId) delete store.sessions[sessionId];
  }
  await writeStore(store);
}

export async function createSession(userId: string, ttlMs: number): Promise<string> {
  const store = await readStore();
  const sessionId = crypto.randomUUID();
  store.sessions[sessionId] = {
    userId,
    expiresAt: Date.now() + ttlMs,
  };
  await writeStore(store);
  return sessionId;
}

export async function getSession(sessionId: string): Promise<StoredSession | null> {
  const store = await readStore();
  const session = store.sessions[sessionId];
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    delete store.sessions[sessionId];
    await writeStore(store);
    return null;
  }
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const store = await readStore();
  delete store.sessions[sessionId];
  await writeStore(store);
}

export async function updateUserConnections(
  userId: string,
  connections: StoredUser["connections"],
  activeConnectionId: string | null,
): Promise<void> {
  const store = await readStore();
  const user = store.users[userId];
  if (!user) return;
  user.connections = connections;
  user.activeConnectionId = activeConnectionId;
  await writeStore(store);
}

export async function updateUserTokens(userId: string, encryptedTokens: string): Promise<void> {
  const store = await readStore();
  const user = store.users[userId];
  if (!user) return;
  user.encryptedTokens = encryptedTokens;
  await writeStore(store);
}
