import { NextResponse } from "next/server";
import { toCreateTransactionRpcPayload, validateCreateTransaction } from "@/lib/transactions";
import type { CreateTransactionInput } from "@/lib/transactions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured. Add the required environment variables." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required." }, { status: 400 });
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    return NextResponse.json({ error: "Business not found or access denied." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("business_transactions")
    .select("id, transaction_type, status, document_no, business_date, amount_paise, cash_delta_paise, party_id, notes, created_at, posted_at, transaction_payments(id, amount_paise, payment_method, payment_date, reference)")
    .eq("business_id", businessId)
    .order("business_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Could not load transactions." }, { status: 500 });
  }

  return NextResponse.json({ transactions: data });
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

  try {
    const input = parseTransactionInput(body);
    validateCreateTransaction(input);

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", input.businessId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found or access denied." }, { status: 404 });
    }

    const { data, error } = await supabase.rpc("create_business_transaction", {
      p_payload: toCreateTransactionRpcPayload(input)
    });

    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
      return NextResponse.json({
        error: status === 500 ? "Transaction could not be saved. Check the database migration and try again." : error.message
      }, { status });
    }

    return NextResponse.json({ transaction: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Invalid transaction."
    }, { status: 400 });
  }
}

function parseTransactionInput(value: unknown): CreateTransactionInput {
  if (!value || typeof value !== "object") throw new Error("Request body must be an object.");
  const body = value as Record<string, unknown>;
  if (typeof body.businessId !== "string" ||
      typeof body.transactionType !== "string" ||
      typeof body.businessDate !== "string" ||
      typeof body.idempotencyKey !== "string" ||
      typeof body.amountPaise !== "number" ||
      !Array.isArray(body.payments)) {
    throw new Error("Required transaction fields are missing or have the wrong type.");
  }

  const payments = body.payments.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`payments[${index}] must be an object.`);
    const payment = value as Record<string, unknown>;
    if (typeof payment.amountPaise !== "number" || typeof payment.method !== "string") {
      throw new Error(`payments[${index}] requires amountPaise and method.`);
    }
    if (payment.paymentDate !== undefined && typeof payment.paymentDate !== "string") {
      throw new Error(`payments[${index}].paymentDate must be a string.`);
    }
    if (payment.reference !== undefined && typeof payment.reference !== "string") {
      throw new Error(`payments[${index}].reference must be a string.`);
    }
    return {
      amountPaise: payment.amountPaise,
      method: payment.method as CreateTransactionInput["payments"][number]["method"],
      ...(typeof payment.paymentDate === "string" ? { paymentDate: payment.paymentDate } : {}),
      ...(typeof payment.reference === "string" ? { reference: payment.reference } : {})
    };
  });

  return {
    businessId: body.businessId,
    transactionType: body.transactionType as CreateTransactionInput["transactionType"],
    businessDate: body.businessDate,
    amountPaise: body.amountPaise,
    idempotencyKey: body.idempotencyKey,
    payments,
    ...(typeof body.partyId === "string" ? { partyId: body.partyId } : {}),
    ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
    ...(typeof body.cashDeltaPaise === "number" ? { cashDeltaPaise: body.cashDeltaPaise } : {})
  };
}
