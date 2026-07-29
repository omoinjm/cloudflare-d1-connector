import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SavedConnection } from "@/types/d1";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  encryptedTokens: string;
  connections: SavedConnection[];
  activeConnectionId: string | null;
}

export interface StoredSession {
  userId: string;
  expiresAt: number;
}

interface AppStore {
  users: Record<string, StoredUser>;
  sessions: Record<string, StoredSession>;
}

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

async function readStore(): Promise<AppStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AppStore;
    return {
      users: parsed.users ?? {},
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return { users: {}, sessions: {} };
  }
}

async function writeStore(store: AppStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

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
  connections: SavedConnection[],
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
