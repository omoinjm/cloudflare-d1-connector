import { NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/server/cloudflare-oauth";
import {
  DEFAULT_OAUTH_SCOPES,
  getAppUrl,
  getAuthorizationScopes,
  getOAuthRedirectUri,
  getOAuthScopes,
} from "@/lib/server/env";

/** Dev helper: shows the OAuth URL shape without exposing secrets. */
export async function GET() {
  const authScopes = getAuthorizationScopes();
  const url = buildAuthorizationUrl("debug-state");

  return NextResponse.json({
    appUrl: getAppUrl(),
    redirectUri: getOAuthRedirectUri(),
    defaultScopes: DEFAULT_OAUTH_SCOPES,
    scopesSentInAuthRequest: authScopes,
    authorizationUrlPreview: url.replace(/state=[^&]+/, "state=…"),
  });
}
