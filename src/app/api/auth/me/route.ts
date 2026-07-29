import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";
import { getUserById } from "@/lib/server/store";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ authenticated: false });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
}
