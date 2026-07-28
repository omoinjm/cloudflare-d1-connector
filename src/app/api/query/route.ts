import { NextRequest, NextResponse } from "next/server";
import type { D1ApiResponse, QueryRequestBody } from "@/types/d1";
import { buildD1QueryUrl } from "@/lib/d1-api";

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

  const { accountId, databaseId, apiToken, sql } = body;

  if (!accountId?.trim() || !databaseId?.trim() || !apiToken?.trim()) {
    return NextResponse.json(
      {
        success: false,
        errors: [{ code: 400, message: "Account ID, Database ID, and API Token are required" }],
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

  const url = buildD1QueryUrl({ accountId, databaseId });

  try {
    const cfResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: sql.trim() }),
    });

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
    return NextResponse.json(
      {
        success: false,
        errors: [{ code: 503, message }],
        messages: [],
        result: [],
      } satisfies D1ApiResponse,
      { status: 503 },
    );
  }
}
