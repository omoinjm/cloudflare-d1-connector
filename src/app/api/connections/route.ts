import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/server/session";
import { getUserById, updateUserConnections } from "@/lib/server/store";
import type { SavedConnection } from "@/types/d1";
import { defaultConnectionLabel } from "@/types/d1";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const user = await getUserById(userId);
    if (!user) return unauthorized();

    return NextResponse.json({
      connections: user.connections,
      activeId: user.activeConnectionId,
    });
  } catch {
    return unauthorized();
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const user = await getUserById(userId);
    if (!user) return unauthorized();

    const body = (await request.json()) as {
      accountId?: string;
      databaseId?: string;
      label?: string;
    };

    const accountId = body.accountId?.trim();
    const databaseId = body.databaseId?.trim();
    if (!accountId || !databaseId) {
      return NextResponse.json(
        { error: "accountId and databaseId are required" },
        { status: 400 },
      );
    }

    const label =
      body.label?.trim() ||
      defaultConnectionLabel({ databaseId });

    const existingIndex = user.connections.findIndex(
      (c) => c.accountId === accountId && c.databaseId === databaseId,
    );

    const connections = [...user.connections];
    let activeId: string;

    if (existingIndex >= 0) {
      const existing = connections[existingIndex];
      connections[existingIndex] = {
        ...existing,
        label,
        savedAt: new Date().toISOString(),
      };
      activeId = existing.id;
    } else {
      const connection: SavedConnection = {
        id: crypto.randomUUID(),
        label,
        accountId,
        databaseId,
        savedAt: new Date().toISOString(),
      };
      connections.unshift(connection);
      activeId = connection.id;
    }

    await updateUserConnections(userId, connections, activeId);

    const saved = connections.find((c) => c.id === activeId)!;
    return NextResponse.json({ connection: saved, activeId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const user = await getUserById(userId);
    if (!user) return unauthorized();

    const body = (await request.json()) as { activeId?: string | null };
    const activeId = body.activeId ?? null;

    if (activeId && !user.connections.some((c) => c.id === activeId)) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    await updateUserConnections(userId, user.connections, activeId);
    return NextResponse.json({ activeId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update active connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
