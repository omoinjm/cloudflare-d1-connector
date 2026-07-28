import {
  defaultConnectionLabel,
  type ConnectionInstance,
  type ConnectionStore,
  type D1Config,
  type StorageMode,
  type StoredConnectionRecord,
} from "@/types/d1";

const LOCAL_STORE_KEY = "d1_studio_connections_local";
const SESSION_STORE_KEY = "d1_studio_connections_session";
const LEGACY_CONNECTION_KEY = "d1_studio_connection";
const CRYPTO_KEY = "d1_studio_crypto_key";

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(CRYPTO_KEY);
  if (stored) {
    const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const exported = await crypto.subtle.exportKey("raw", key);
  localStorage.setItem(
    CRYPTO_KEY,
    btoa(String.fromCharCode(...new Uint8Array(exported))),
  );
  return key;
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function encryptValue(value: string): Promise<string> {
  const key = await getOrCreateCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptValue(ciphertext: string): Promise<string> {
  const key = await getOrCreateCryptoKey();
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

function storeKey(mode: StorageMode): string {
  return mode === "local" ? LOCAL_STORE_KEY : SESSION_STORE_KEY;
}

function getStorage(mode: StorageMode): Storage {
  return mode === "local" ? localStorage : sessionStorage;
}

function readStore(mode: StorageMode): ConnectionStore {
  const raw = getStorage(mode).getItem(storeKey(mode));
  if (!raw) return { activeId: null, connections: [] };

  try {
    const parsed = JSON.parse(raw) as ConnectionStore;
    return {
      activeId: parsed.activeId ?? null,
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    };
  } catch {
    return { activeId: null, connections: [] };
  }
}

function writeStore(mode: StorageMode, store: ConnectionStore): void {
  getStorage(mode).setItem(storeKey(mode), JSON.stringify(store));
}

function generateId(): string {
  return crypto.randomUUID();
}

export async function hashConnection(config: D1Config): Promise<string> {
  return sha256Hex(
    `${config.accountId.trim()}|${config.databaseId.trim()}|${config.apiToken.trim()}`,
  );
}

async function toInstance(record: StoredConnectionRecord): Promise<ConnectionInstance> {
  const apiToken = await decryptValue(record.encryptedToken);
  return {
    id: record.id,
    label: record.label,
    config: {
      accountId: record.accountId,
      databaseId: record.databaseId,
      apiToken,
    },
    fingerprint: record.fingerprint,
    mode: record.mode,
    savedAt: record.savedAt,
  };
}

async function migrateLegacyConnection(): Promise<void> {
  const raw =
    sessionStorage.getItem(LEGACY_CONNECTION_KEY) ??
    localStorage.getItem(LEGACY_CONNECTION_KEY);
  if (!raw) return;

  try {
    const legacy = JSON.parse(raw) as {
      encrypted: string;
      fingerprint: string;
      mode: StorageMode;
      savedAt: string;
    };

    const decrypted = await decryptValue(legacy.encrypted);
    const parsed = JSON.parse(decrypted) as D1Config;
    const config: D1Config = {
      accountId: parsed.accountId.trim(),
      databaseId: parsed.databaseId.trim(),
      apiToken: parsed.apiToken.trim(),
    };

    await upsertConnection(config, legacy.mode, defaultConnectionLabel(config));
  } finally {
    localStorage.removeItem(LEGACY_CONNECTION_KEY);
    sessionStorage.removeItem(LEGACY_CONNECTION_KEY);
  }
}

export async function loadConnections(): Promise<{
  connections: ConnectionInstance[];
  activeId: string | null;
}> {
  await migrateLegacyConnection();

  const localStore = readStore("local");
  const sessionStore = readStore("session");

  const byId = new Map<string, StoredConnectionRecord>();
  for (const record of localStore.connections) byId.set(record.id, record);
  for (const record of sessionStore.connections) byId.set(record.id, record);

  const records = Array.from(byId.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );

  const connections = await Promise.all(records.map(toInstance));

  const activeId =
    (sessionStore.activeId && byId.has(sessionStore.activeId)
      ? sessionStore.activeId
      : null) ??
    (localStore.activeId && byId.has(localStore.activeId) ? localStore.activeId : null) ??
    connections[0]?.id ??
    null;

  return { connections, activeId };
}

export async function upsertConnection(
  config: D1Config,
  mode: StorageMode,
  label?: string,
  existingId?: string,
): Promise<ConnectionInstance> {
  const trimmed: D1Config = {
    accountId: config.accountId.trim(),
    databaseId: config.databaseId.trim(),
    apiToken: config.apiToken.trim(),
  };

  const id = existingId ?? generateId();
  const fingerprint = await hashConnection(trimmed);
  const encryptedToken = await encryptValue(trimmed.apiToken);

  const record: StoredConnectionRecord = {
    id,
    label: label?.trim() || defaultConnectionLabel(trimmed),
    accountId: trimmed.accountId,
    databaseId: trimmed.databaseId,
    encryptedToken,
    fingerprint,
    mode,
    savedAt: new Date().toISOString(),
  };

  for (const storeMode of ["local", "session"] as StorageMode[]) {
    const store = readStore(storeMode);
    store.connections = store.connections.filter((c) => c.id !== id);
    if (store.activeId === id) store.activeId = null;
    writeStore(storeMode, store);
  }

  const targetStore = readStore(mode);
  targetStore.connections.unshift(record);
  targetStore.activeId = id;
  writeStore(mode, targetStore);

  return toInstance(record);
}

export function setActiveConnection(id: string): void {
  for (const mode of ["local", "session"] as StorageMode[]) {
    const store = readStore(mode);
    const exists = store.connections.some((c) => c.id === id);
    if (exists) {
      store.activeId = id;
      writeStore(mode, store);
    } else if (store.activeId === id) {
      store.activeId = null;
      writeStore(mode, store);
    }
  }
}

export function removeConnection(id: string): string | null {
  let nextActiveId: string | null = null;

  for (const mode of ["local", "session"] as StorageMode[]) {
    const store = readStore(mode);
    const index = store.connections.findIndex((c) => c.id === id);
    if (index === -1) continue;

    store.connections.splice(index, 1);

    if (store.activeId === id) {
      store.activeId = store.connections[0]?.id ?? null;
      nextActiveId = store.activeId;
    }

    writeStore(mode, store);
  }

  return nextActiveId;
}

export function clearAllConnections(): void {
  localStorage.removeItem(LOCAL_STORE_KEY);
  sessionStorage.removeItem(SESSION_STORE_KEY);
}

export function formatFingerprint(fingerprint: string): string {
  return `${fingerprint.slice(0, 8)}…${fingerprint.slice(-6)}`;
}

export function connectionIdentity(config: Pick<D1Config, "accountId" | "databaseId">): string {
  return `${config.accountId.trim()} / ${config.databaseId.trim()}`;
}
