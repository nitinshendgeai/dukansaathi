import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool, withUserContext } from "@/lib/db";
import { toCreateTransactionRpcPayload, validateCreateTransaction } from "@/lib/transactions";
import type { CreateTransactionInput } from "@/lib/transactions";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const businessId = new URL(request.url).searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });

  try {
    const business = await pool.query(
      "select id from public.businesses where id = $1 and owner_user_id = $2",
      [businessId, user.id]
    );
    if (!business.rows[0]) return NextResponse.json({ error: "Business not found or access denied." }, { status: 404 });

    const result = await pool.query(
      `select t.id, t.transaction_type, t.status, t.document_no, t.business_date,
              t.amount_paise, t.cash_delta_paise, t.party_id, t.notes, t.created_at, t.posted_at,
              coalesce((
                select json_agg(json_build_object(
                  'id', p.id, 'amount_paise', p.amount_paise,
                  'payment_method', p.payment_method, 'payment_date', p.payment_date, 'reference', p.reference
                ) order by p.created_at)
                from public.transaction_payments p
                where p.business_id = t.business_id and p.transaction_id = t.id
              ), '[]'::json) as transaction_payments
       from public.business_transactions t
       where t.business_id = $1
       order by t.business_date desc, t.created_at desc
       limit 100`,
      [businessId]
    );
    return NextResponse.json({ transactions: result.rows });
  } catch {
    return NextResponse.json({ error: "Could not load transactions. Check database migration." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const input = parseTransactionInput(body);
    validateCreateTransaction(input);

    const client = await pool.connect();
    try {
      await client.query("begin");
      const business = await client.query(
        "select id from public.businesses where id = $1 and owner_user_id = $2 for share",
        [input.businessId, user.id]
      );
      if (!business.rows[0]) {
        await client.query("rollback");
        return NextResponse.json({ error: "Business not found or access denied." }, { status: 404 });
      }

      const created = await withUserContext(client, user.id, async () => {
        const result = await client.query(
          "select (public.create_business_transaction($1::jsonb)).*",
          [JSON.stringify(toCreateTransactionRpcPayload(input))]
        );
        return result.rows[0];
      });
      await client.query("commit");
      return NextResponse.json({ transaction: created }, { status: 201 });
    } catch (error) {
      await client.query("rollback");
      if (typeof error === "object" && error !== null && "code" in error && error.code === "22023") {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid transaction." }, { status: 400 });
      }
      if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
        return NextResponse.json({ error: "Business not found or access denied." }, { status: 403 });
      }
      return NextResponse.json({ error: "Transaction could not be saved. Check database migration and try again." }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid transaction." }, { status: 400 });
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
