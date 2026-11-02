import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe. It performs a real query so a broken
 * DATABASE_URL or an unreachable database is visible immediately instead of
 * only surfacing later as a 500 on auth routes.
 */
export async function GET() {
  try {
    const rows = await db.execute(sql`select 1 as ok`);
    return NextResponse.json({ ok: true, db: true, rows: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, db: false, error: message.slice(0, 300) },
      { status: 503 },
    );
  }
}
