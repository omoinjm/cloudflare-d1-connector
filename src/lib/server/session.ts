import { cookies } from "next/headers";
import { createSession, deleteSession, getSession } from "@/lib/server/store";

export const SESSION_COOKIE = "d1_studio_session";
export const OAUTH_STATE_COOKIE = "d1_studio_oauth_state";
export const OAUTH_PKCE_COOKIE = "d1_studio_oauth_pkce";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  return session?.userId ?? null;
}

export async function requireSessionUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export async function startSession(userId: string): Promise<void> {
  const sessionId = await createSession(userId, SESSION_TTL_MS);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await deleteSession(sessionId);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function setOAuthState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  return Boolean(stored && stored === state);
}

export async function setOAuthPkceVerifier(verifier: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_PKCE_COOKIE, verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
}

export async function consumeOAuthPkceVerifier(): Promise<string | null> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(OAUTH_PKCE_COOKIE)?.value ?? null;
  cookieStore.delete(OAUTH_PKCE_COOKIE);
  return stored;
}
