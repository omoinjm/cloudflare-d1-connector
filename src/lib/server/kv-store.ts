interface KvConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
}

export const KV_AUTH_ERROR_MESSAGE =
  "Cloudflare KV authentication failed. Set CLOUDFLARE_API_TOKEN to a Cloudflare API token with Workers KV Storage Read and Write on the account/namespace matching CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_KV_NAMESPACE_ID (not the OAuth client secret), then redeploy.";

export function getKvConfig(): KvConfig | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !namespaceId || !apiToken) {
    return null;
  }
  return { accountId, namespaceId, apiToken };
}

export function isKvAuthError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("KV authentication failed");
}

function kvValueUrl(config: KvConfig, key: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`;
}

function throwKvFailure(operation: "read" | "write", status: number, detail: string): never {
  if (status === 401 || status === 403) {
    throw new Error(`KV authentication failed (${status}): ${KV_AUTH_ERROR_MESSAGE}`);
  }
  throw new Error(`KV ${operation} failed (${status}): ${detail}`);
}

export async function kvGet(key: string): Promise<string | null> {
  const config = getKvConfig();
  if (!config) {
    throw new Error("Cloudflare KV is not configured");
  }

  const response = await fetch(kvValueUrl(config, key), {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = await response.text();
    throwKvFailure("read", response.status, detail);
  }

  return response.text();
}

export async function kvPut(key: string, value: string): Promise<void> {
  const config = getKvConfig();
  if (!config) {
    throw new Error("Cloudflare KV is not configured");
  }

  const form = new FormData();
  form.append("value", value);

  const response = await fetch(kvValueUrl(config, key), {
    method: "PUT",
    headers: { Authorization: `Bearer ${config.apiToken}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throwKvFailure("write", response.status, detail);
  }
}

export type KvProbeStatus = "ok" | "unauthorized" | "error" | "unconfigured";

/** Probe KV without exposing secrets. Used by /api/auth/debug. */
export async function probeKv(): Promise<{
  configured: boolean;
  accountIdSet: boolean;
  namespaceIdSet: boolean;
  apiTokenSet: boolean;
  kvStatus: KvProbeStatus;
  kvError?: string;
}> {
  const accountIdSet = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim());
  const namespaceIdSet = Boolean(process.env.CLOUDFLARE_KV_NAMESPACE_ID?.trim());
  const apiTokenSet = Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim());
  const configured = Boolean(getKvConfig());

  if (!configured) {
    return {
      configured: false,
      accountIdSet,
      namespaceIdSet,
      apiTokenSet,
      kvStatus: "unconfigured",
    };
  }

  try {
    await kvGet("__d1-studio-kv-probe__");
    return {
      configured: true,
      accountIdSet,
      namespaceIdSet,
      apiTokenSet,
      kvStatus: "ok",
    };
  } catch (err) {
    if (isKvAuthError(err)) {
      return {
        configured: true,
        accountIdSet,
        namespaceIdSet,
        apiTokenSet,
        kvStatus: "unauthorized",
        kvError: "KV authentication failed (401/403)",
      };
    }
    return {
      configured: true,
      accountIdSet,
      namespaceIdSet,
      apiTokenSet,
      kvStatus: "error",
      kvError: err instanceof Error ? err.message : "KV probe failed",
    };
  }
}
