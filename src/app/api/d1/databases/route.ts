import { NextRequest, NextResponse } from "next/server";
import { listD1Databases } from "@/lib/server/cf-api";
import { requireSessionUserId } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const accountId = new URL(request.url).searchParams.get("accountId")?.trim();
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const databases = await listD1Databases(userId, accountId);
    return NextResponse.json({ databases });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list databases";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
