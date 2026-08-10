import { NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/server/cloudflare-oauth";
import {
  DEFAULT_OAUTH_SCOPES,
  getAppUrl,
  getAuthorizationScopes,
  getOAuthRedirectUri,
} from "@/lib/server/env";
import { probeKv } from "@/lib/server/kv-store";

/** Dev helper: shows the OAuth URL shape and KV readiness without exposing secrets. */
export async function GET() {
  const authScopes = getAuthorizationScopes();
  const url = buildAuthorizationUrl("debug-state");
  const kv = await probeKv();

  return NextResponse.json({
    appUrl: getAppUrl(),
    redirectUri: getOAuthRedirectUri(),
    defaultScopes: DEFAULT_OAUTH_SCOPES,
    scopesSentInAuthRequest: authScopes,
    authorizationUrlPreview: url.replace(/state=[^&]+/, "state=…"),
    kv: {
      configured: kv.configured,
      accountIdSet: kv.accountIdSet,
      namespaceIdSet: kv.namespaceIdSet,
      apiTokenSet: kv.apiTokenSet,
      status: kv.kvStatus,
      ...(kv.kvError ? { error: kv.kvError } : {}),
    },
  });
}
