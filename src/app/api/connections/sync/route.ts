import { NextResponse } from "next/server";
import { syncConnectionsFromCloudflare } from "@/lib/server/sync-connections";
import { requireSessionUserId } from "@/lib/server/session";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST() {
  try {
    const userId = await requireSessionUserId();
    const result = await syncConnectionsFromCloudflare(userId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync databases";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
