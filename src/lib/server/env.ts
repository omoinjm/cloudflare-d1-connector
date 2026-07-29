function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function getOAuthRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback`;
}

export function getOAuthClientId(): string {
  return required("CLOUDFLARE_OAUTH_CLIENT_ID");
}

export function getOAuthClientSecret(): string {
  return required("CLOUDFLARE_OAUTH_CLIENT_SECRET");
}

export function getSessionSecret(): string {
  return required("SESSION_SECRET");
}

export const CF_OAUTH_AUTH_URL = "https://dash.cloudflare.com/oauth2/auth";
export const CF_OAUTH_TOKEN_URL = "https://dash.cloudflare.com/oauth2/token";
export const CF_OAUTH_USERINFO_URL = "https://dash.cloudflare.com/oauth2/userinfo";
export const CF_OAUTH_REVOKE_URL = "https://dash.cloudflare.com/oauth2/revoke";

/**
 * Default scopes for third-party OAuth clients (IDs from GET /oauth/scopes).
 * Format: hyphen-separated resource + dot action, e.g. account-settings.read
 * Do not use Wrangler colon scopes (account:read) or wrong delimiters (account.settings.read).
 */
export const DEFAULT_OAUTH_SCOPES = [
  "account-settings.read",
  "user-details.read",
  "d1.read",
  "d1.write",
];

/**
 * OAuth scopes sent in the authorization URL. Must match scopes registered on your OAuth
 * client (see GET /oauth/scopes for valid IDs, e.g. account-settings.read).
 */
export function getOAuthScopes(): string[] {
  const raw = process.env.CLOUDFLARE_OAUTH_SCOPES?.trim();
  if (!raw || raw.toLowerCase() === "auto") return DEFAULT_OAUTH_SCOPES;
  return raw.split(/\s+/).filter(Boolean);
}

/** Scopes for the authorization URL, including offline_access for refresh tokens. */
export function getAuthorizationScopes(): string[] {
  const scopes = getOAuthScopes();
  return scopes.includes("offline_access") ? scopes : [...scopes, "offline_access"];
}
