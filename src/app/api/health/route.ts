import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    await pool.query("select 1");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
