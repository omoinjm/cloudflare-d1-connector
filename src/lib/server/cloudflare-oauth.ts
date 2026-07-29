import {
  CF_OAUTH_AUTH_URL,
  CF_OAUTH_REVOKE_URL,
  CF_OAUTH_TOKEN_URL,
  CF_OAUTH_USERINFO_URL,
  getOAuthClientId,
  getOAuthClientSecret,
  getOAuthRedirectUri,
  getAuthorizationScopes,
  getOAuthScopes,
} from "@/lib/server/env";
import type { OAuthTokens } from "@/lib/server/store";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface CloudflareUserInfo {
  sub: string;
  email?: string;
  name?: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkcePairAsync(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getOAuthClientId(),
    redirect_uri: getOAuthRedirectUri(),
    response_type: "code",
    state,
  });

  params.set("scope", getAuthorizationScopes().join(" "));

  return `${CF_OAUTH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(code: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getOAuthRedirectUri(),
    client_id: getOAuthClientId(),
    client_secret: getOAuthClientSecret(),
  });

  const response = await fetch(CF_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token exchange failed: ${text}`);
  }

  return parseTokenResponse((await response.json()) as TokenResponse);
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getOAuthClientId(),
    client_secret: getOAuthClientSecret(),
  });

  const response = await fetch(CF_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token refresh failed: ${text}`);
  }

  const payload = (await response.json()) as TokenResponse;
  const tokens = parseTokenResponse(payload);
  if (!payload.refresh_token) {
    tokens.refreshToken = refreshToken;
  }
  return tokens;
}

export async function fetchUserInfo(accessToken: string): Promise<CloudflareUserInfo> {
  const response = await fetch(CF_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth userinfo failed: ${text}`);
  }

  return (await response.json()) as CloudflareUserInfo;
}

export async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({
    token,
    client_id: getOAuthClientId(),
    client_secret: getOAuthClientSecret(),
  });

  await fetch(CF_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function parseTokenResponse(payload: TokenResponse): OAuthTokens {
  if (!payload.access_token) {
    throw new Error("OAuth response missing access_token");
  }
  if (!payload.refresh_token) {
    throw new Error(
      "OAuth response missing refresh_token. In Cloudflare Dashboard → OAuth clients, enable the Refresh Token grant type, then sign in again.",
    );
  }

  const expiresIn = payload.expires_in ?? 3600;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000 - 60_000,
    scope: payload.scope ?? getOAuthScopes().join(" "),
    tokenType: payload.token_type ?? "Bearer",
  };
}

export function serializeTokens(tokens: OAuthTokens): string {
  return JSON.stringify(tokens);
}

export function deserializeTokens(raw: string): OAuthTokens {
  return JSON.parse(raw) as OAuthTokens;
}
