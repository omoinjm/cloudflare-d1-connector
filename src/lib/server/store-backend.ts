import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKvConfig, kvGet, kvPut } from "@/lib/server/kv-store";
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

export interface AppStore {
  users: Record<string, StoredUser>;
  sessions: Record<string, StoredSession>;
}

interface StoreBackend {
  read(): Promise<AppStore>;
  write(store: AppStore): Promise<void>;
}

const KV_STORE_KEY = "d1-studio:app-store";
const FILE_STORE_PATH = path.join(process.cwd(), "data", "store.json");

function emptyStore(): AppStore {
  return { users: {}, sessions: {} };
}

function parseStore(raw: unknown): AppStore {
  const parsed = raw as Partial<AppStore>;
  return {
    users: parsed.users ?? {},
    sessions: parsed.sessions ?? {},
  };
}

function useKvStorage(): boolean {
  if (!getKvConfig()) return false;
  // Vercel has a read-only filesystem; KV is required in production.
  if (process.env.VERCEL) return true;
  // Opt in locally when you want to exercise KV against real credentials.
  return process.env.USE_KV_STORAGE === "1";
}

function requireVercelStorage(): void {
  if (process.env.VERCEL && !getKvConfig()) {
    throw new Error(
      "Persistent storage is required on Vercel. Create a Workers KV namespace and set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, and CLOUDFLARE_API_TOKEN, then redeploy.",
    );
  }
}

function createFileBackend(): StoreBackend {
  return {
    async read() {
      try {
        const raw = await readFile(FILE_STORE_PATH, "utf8");
        return parseStore(JSON.parse(raw));
      } catch {
        return emptyStore();
      }
    },
    async write(store) {
      await mkdir(path.dirname(FILE_STORE_PATH), { recursive: true });
      await writeFile(FILE_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    },
  };
}

function createKvBackend(): StoreBackend {
  return {
    async read() {
      const raw = await kvGet(KV_STORE_KEY);
      if (!raw) return emptyStore();
      return parseStore(JSON.parse(raw));
    },
    async write(store) {
      await kvPut(KV_STORE_KEY, JSON.stringify(store));
    },
  };
}

let backend: StoreBackend | null = null;

function getStoreBackend(): StoreBackend {
  if (!backend) {
    if (useKvStorage()) {
      backend = createKvBackend();
    } else {
      requireVercelStorage();
      backend = createFileBackend();
    }
  }
  return backend;
}

export async function readStore(): Promise<AppStore> {
  return getStoreBackend().read();
}

export async function writeStore(store: AppStore): Promise<void> {
  await getStoreBackend().write(store);
}
