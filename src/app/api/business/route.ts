import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  try {
    const result = await pool.query(
      "select id, name, business_type, currency_code, timezone, created_at from public.businesses where owner_user_id = $1 limit 1",
      [user.id]
    );
    return NextResponse.json({ business: result.rows[0] ?? null });
  } catch {
    return NextResponse.json({ error: "Could not load business profile. Check database migration." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("name" in body) || typeof body.name !== "string") {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  }

  const name = body.name.trim();
  const businessType = "businessType" in body && typeof body.businessType === "string"
    ? body.businessType.trim().slice(0, 80) || "general"
    : "general";
  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Business name must be between 1 and 120 characters." }, { status: 400 });
  }

  try {
    const existing = await pool.query(
      "select id, name, business_type, currency_code, timezone from public.businesses where owner_user_id = $1 limit 1",
      [user.id]
    );
    if (existing.rows[0]) return NextResponse.json({ business: existing.rows[0], existing: true });

    const result = await pool.query(
      "insert into public.businesses (owner_user_id, name, business_type) values ($1, $2, $3) returning id, name, business_type, currency_code, timezone",
      [user.id, name, businessType]
    );
    return NextResponse.json({ business: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "A business is already registered for this account. Refresh and try again." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create business profile." }, { status: 500 });
  }
}
