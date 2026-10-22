import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const values = body as Record<string, unknown>;
  const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
  const password = typeof values.password === "string" ? values.password : "";
  if (!email || !password || email.length > 254 || password.length > 128) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: "Server setup is incomplete. Configure DATABASE_URL and SESSION_SECRET." }, { status: 503 });
  }

  try {
    const result = await pool.query("select id, email, password_hash from public.app_users where email = $1", [email]);
    const user = result.rows[0] as { id: string; email: string; password_hash: string } | undefined;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    await createSession({ id: user.id, email: user.email });
    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch {
    return NextResponse.json({ error: "Could not sign in. Check database setup and try again." }, { status: 500 });
  }
}
