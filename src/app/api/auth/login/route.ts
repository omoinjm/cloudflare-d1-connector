import { NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/server/cloudflare-oauth";
import { setOAuthState } from "@/lib/server/session";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    await setOAuthState(state);
    return NextResponse.redirect(buildAuthorizationUrl(state));
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
