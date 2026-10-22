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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 10 || password.length > 128) {
    return NextResponse.json({ error: "Password must be between 10 and 128 characters." }, { status: 400 });
  }
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: "Server setup is incomplete. Configure DATABASE_URL and SESSION_SECRET." }, { status: 503 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "insert into public.app_users (email, password_hash) values ($1, $2) returning id, email",
      [email, passwordHash]
    );
    const user = result.rows[0] as { id: string; email: string };
    await createSession(user);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create your account. Check database setup and try again." }, { status: 500 });
  }
}
