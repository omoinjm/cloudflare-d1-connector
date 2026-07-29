import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/server/session";
import { getUserById, updateUserConnections } from "@/lib/server/store";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const user = await getUserById(userId);
    if (!user) return unauthorized();

    const { id } = await context.params;
    const body = (await request.json()) as { label?: string };
    const label = body.label?.trim();
    if (!label) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const index = user.connections.findIndex((c) => c.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const connections = [...user.connections];
    connections[index] = {
      ...connections[index],
      label,
      savedAt: new Date().toISOString(),
    };

    await updateUserConnections(userId, connections, user.activeConnectionId);
    return NextResponse.json({ connection: connections[index] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const user = await getUserById(userId);
    if (!user) return unauthorized();

    const { id } = await context.params;
    const connections = user.connections.filter((c) => c.id !== id);
    if (connections.length === user.connections.length) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const activeId =
      user.activeConnectionId === id
        ? connections[0]?.id ?? null
        : user.activeConnectionId;

    await updateUserConnections(userId, connections, activeId);
    return NextResponse.json({ activeId, connections });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
