import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/server/crypto";
import { deserializeTokens, revokeToken } from "@/lib/server/cloudflare-oauth";
import { clearSession, getSessionUserId } from "@/lib/server/session";
import { getUserById } from "@/lib/server/store";

export async function POST() {
  const userId = await getSessionUserId();
  if (userId) {
    const user = await getUserById(userId);
    if (user?.encryptedTokens) {
      try {
        const tokens = deserializeTokens(await decryptSecret(user.encryptedTokens));
        await revokeToken(tokens.refreshToken);
      } catch {
        // Best-effort revoke; still clear local session.
      }
    }
  }

  await clearSession();
  return NextResponse.json({ success: true });
}
