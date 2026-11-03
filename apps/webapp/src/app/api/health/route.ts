import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { env } from "@/env";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe. It performs a real query so a broken
 * DATABASE_URL or an unreachable database is visible immediately instead of
 * only surfacing later as a 500 on auth routes.
 *
 * `?deep=1&token=<BETTER_AUTH_SECRET>` additionally runs a full email sign-up
 * and rolls the created rows back. This verifies the complete auth flow
 * (including databaseHooks) without needing an external POST client.
 */
export async function GET(request: Request) {
  try {
    const rows = await db.execute(sql`select 1 as ok`);
    const result: Record<string, unknown> = {
      ok: true,
      db: true,
      rows: rows.length,
    };

    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (url.searchParams.get("deep") === "1" && token === env.BETTER_AUTH_SECRET) {
      const email = `smoke-${randomUUID()}@example.com`;
      try {
        const response = await auth.api.signUpEmail({
          body: {
            name: "Smoke Check",
            email,
            password: "Sm0keCheck!2026",
          },
          headers: new Headers(),
          asResponse: true,
        });
        const body = await response.text();
        result.signup = { status: response.status, body: body.slice(0, 500) };
      } catch (error) {
        result.signup = {
          status: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        // Remove everything the smoke sign-up created. Cascades on "user"
        // handle account/session; the after-hook org needs explicit cleanup.
        try {
          await db.execute(
            sql`delete from org_user where user_id in (select id from "user" where email = ${email})`,
          );
          await db.execute(
            sql`delete from org where slug in (select 'org-' || left(id, 8) from "user" where email = ${email})`,
          );
          await db.execute(sql`delete from "user" where email = ${email}`);
        } catch (cleanupError) {
          result.cleanupError =
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, db: false, error: message.slice(0, 300) },
      { status: 503 },
    );
  }
}
