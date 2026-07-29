import { decryptSecret, encryptSecret } from "@/lib/server/crypto";
import {
  deserializeTokens,
  refreshAccessToken,
  serializeTokens,
} from "@/lib/server/cloudflare-oauth";
import { getUserById, updateUserTokens, type OAuthTokens } from "@/lib/server/store";

export async function saveUserTokens(userId: string, tokens: OAuthTokens): Promise<void> {
  const encrypted = await encryptSecret(serializeTokens(tokens));
  await updateUserTokens(userId, encrypted);
}

export async function getUserAccessToken(userId: string): Promise<string> {
  const user = await getUserById(userId);
  if (!user?.encryptedTokens) {
    throw new Error("Cloudflare OAuth session expired. Sign in again.");
  }

  let tokens = deserializeTokens(await decryptSecret(user.encryptedTokens));

  if (tokens.expiresAt <= Date.now()) {
    tokens = await refreshAccessToken(tokens.refreshToken);
    await saveUserTokens(userId, tokens);
  }

  return tokens.accessToken;
}

export async function cfApiFetch(
  userId: string,
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const accessToken = await getUserAccessToken(userId);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}

export interface CfAccount {
  id: string;
  name: string;
}

export interface CfD1Database {
  uuid: string;
  name: string;
}

export async function listAccounts(userId: string): Promise<CfAccount[]> {
  const response = await cfApiFetch(
    userId,
    "https://api.cloudflare.com/client/v4/accounts?per_page=50",
  );
  const data = (await response.json()) as {
    success: boolean;
    result: { id: string; name: string }[];
    errors?: { message: string }[];
  };

  if (!response.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message ?? "Failed to list Cloudflare accounts");
  }

  return data.result.map((account) => ({ id: account.id, name: account.name }));
}

export async function listD1Databases(
  userId: string,
  accountId: string,
): Promise<CfD1Database[]> {
  const response = await cfApiFetch(
    userId,
    `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/d1/database?per_page=100`,
  );
  const data = (await response.json()) as {
    success: boolean;
    result: { uuid: string; name: string }[];
    errors?: { message: string }[];
  };

  if (!response.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message ?? "Failed to list D1 databases");
  }

  return data.result.map((db) => ({ uuid: db.uuid, name: db.name }));
}

export async function executeD1Query(
  userId: string,
  accountId: string,
  databaseId: string,
  sql: string,
): Promise<Response> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/d1/database/${databaseId.trim()}/query`;
  return cfApiFetch(userId, url, {
    method: "POST",
    body: JSON.stringify({ sql: sql.trim() }),
  });
}
