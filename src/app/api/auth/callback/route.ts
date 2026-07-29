import { NextRequest, NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  fetchUserInfo,
} from "@/lib/server/cloudflare-oauth";
import { saveUserTokens } from "@/lib/server/cf-api";
import { getAppUrl } from "@/lib/server/env";
import { consumeOAuthState, startSession } from "@/lib/server/session";
import { getUserById, upsertUser } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${getAppUrl()}/?auth_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${getAppUrl()}/?auth_error=missing_code`);
  }

  const validState = await consumeOAuthState(state);
  if (!validState) {
    return NextResponse.redirect(`${getAppUrl()}/?auth_error=invalid_state`);
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const profile = await fetchUserInfo(tokens.accessToken);
    const userId = profile.sub;

    const existing = await getUserById(userId);
    await upsertUser({
      id: userId,
      email: profile.email ?? existing?.email ?? "",
      name: profile.name ?? existing?.name ?? "Cloudflare user",
      encryptedTokens: existing?.encryptedTokens ?? "",
      connections: existing?.connections ?? [],
      activeConnectionId: existing?.activeConnectionId ?? null,
    });

    await saveUserTokens(userId, tokens);
    await startSession(userId);

    return NextResponse.redirect(getAppUrl());
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth callback failed";
    return NextResponse.redirect(
      `${getAppUrl()}/?auth_error=${encodeURIComponent(message)}`,
    );
  }
}
