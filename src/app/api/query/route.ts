import { NextRequest, NextResponse } from "next/server";
import { executeD1Query as cfExecuteD1Query } from "@/lib/server/cf-api";
import { requireSessionUserId } from "@/lib/server/session";
import { getUserById } from "@/lib/server/store";
import type { D1ApiResponse, QueryRequestBody } from "@/types/d1";

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      errors: [{ code: 401, message: "Unauthorized" }],
      messages: [],
      result: [],
    } satisfies D1ApiResponse,
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  let body: QueryRequestBody;

  try {
    body = (await request.json()) as QueryRequestBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        errors: [{ code: 400, message: "Invalid JSON body" }],
        messages: [],
        result: [],
      } satisfies D1ApiResponse,
      { status: 400 },
    );
  }

  const { connectionId, sql } = body;

  if (!connectionId?.trim()) {
    return NextResponse.json(
      {
        success: false,
        errors: [{ code: 400, message: "connectionId is required" }],
        messages: [],
        result: [],
      } satisfies D1ApiResponse,
      { status: 400 },
    );
  }

  if (!sql?.trim()) {
    return NextResponse.json(
      {
        success: false,
        errors: [{ code: 400, message: "SQL query is required" }],
        messages: [],
        result: [],
      } satisfies D1ApiResponse,
      { status: 400 },
    );
  }

  try {
    const userId = await requireSessionUserId();
    const user = await getUserById(userId);
    if (!user) return unauthorized();

    const connection = user.connections.find((c) => c.id === connectionId.trim());
    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          errors: [{ code: 404, message: "Connection not found" }],
          messages: [],
          result: [],
        } satisfies D1ApiResponse,
        { status: 404 },
      );
    }

    const cfResponse = await cfExecuteD1Query(
      userId,
      connection.accountId,
      connection.databaseId,
      sql,
    );

    const data = (await cfResponse.json()) as D1ApiResponse;

    if (!cfResponse.ok || !data.success) {
      const message =
        data.errors?.[0]?.message ??
        data.result?.[0]?.error ??
        "Cloudflare D1 query failed";
      return NextResponse.json(
        {
          success: false,
          errors: data.errors?.length
            ? data.errors
            : [{ code: cfResponse.status, message }],
          messages: data.messages ?? [],
          result: data.result ?? [],
        } satisfies D1ApiResponse,
        { status: cfResponse.status >= 400 ? cfResponse.status : 422 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network error while contacting Cloudflare API";
    const status = message === "Unauthorized" ? 401 : 503;
    return NextResponse.json(
      {
        success: false,
        errors: [{ code: status, message }],
        messages: [],
        result: [],
      } satisfies D1ApiResponse,
      { status },
    );
  }
}
