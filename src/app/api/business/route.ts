import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured. Add the required environment variables." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, business_type, currency_code, timezone, created_at")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load business profile." }, { status: 500 });
  }

  return NextResponse.json({ business: data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured. Add the required environment variables." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
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

  const { data: existing, error: lookupError } = await supabase
    .from("businesses")
    .select("id, name, business_type, currency_code, timezone")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Could not verify existing business." }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ business: existing, existing: true });
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({ owner_user_id: user.id, name, business_type: businessType })
    .select("id, name, business_type, currency_code, timezone")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A business is already registered for this account. Refresh and try again." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create business profile." }, { status: 500 });
  }

  return NextResponse.json({ business: data }, { status: 201 });
}
