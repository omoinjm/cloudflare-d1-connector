import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/server/cf-api";
import { requireSessionUserId } from "@/lib/server/session";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const accounts = await listAccounts(userId);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list accounts";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
