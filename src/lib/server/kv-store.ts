interface KvConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
}

export function getKvConfig(): KvConfig | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !namespaceId || !apiToken) {
    return null;
  }
  return { accountId, namespaceId, apiToken };
}

function kvValueUrl(config: KvConfig, key: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`;
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
    throw new Error(`KV read failed (${response.status}): ${detail}`);
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
    throw new Error(`KV write failed (${response.status}): ${detail}`);
  }
}
