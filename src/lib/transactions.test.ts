import { describe, expect, it } from "vitest";
import { toCreateTransactionRpcPayload, validateCreateTransaction } from "./transactions";

const base = {
  businessId: "business-123",
  businessDate: "2026-10-23",
  idempotencyKey: "sale-unique-0001",
  transactionType: "sale" as const,
  amountPaise: 100_000,
  payments: [{ amountPaise: 60_000, method: "cash" as const }]
};

describe("validateCreateTransaction", () => {
  it("accepts a partly paid credit sale and calculates outstanding", () => {
    const result = validateCreateTransaction(base);
    expect(result.paymentTotalPaise).toBe(60_000);
    expect(result.outstandingPaise).toBe(40_000);
  });

  it("does not allow receipt allocations that do not equal the receipt amount", () => {
    expect(() => validateCreateTransaction({
      ...base,
      transactionType: "customer_receipt",
      amountPaise: 50_000,
      payments: [{ amountPaise: 49_999, method: "upi" }]
    })).toThrow(/must equal/);
  });

  it("rejects payment allocations larger than a sale", () => {
    expect(() => validateCreateTransaction({
      ...base,
      payments: [{ amountPaise: 100_001, method: "cash" }]
    })).toThrow(/cannot exceed/);
  });

  it("rejects invalid calendar dates", () => {
    expect(() => validateCreateTransaction({ ...base, businessDate: "2026-02-30" }))
      .toThrow(/valid YYYY-MM-DD/);
  });

  it("rejects fractional paise and unsafe integers", () => {
    expect(() => validateCreateTransaction({ ...base, amountPaise: 100.5 }))
      .toThrow(/safe integer in paise/);
    expect(() => validateCreateTransaction({ ...base, amountPaise: Number.MAX_SAFE_INTEGER + 1 }))
      .toThrow(/safe integer in paise/);
  });

  it("requires a non-zero cash delta and no payment allocations for cash adjustment", () => {
    expect(() => validateCreateTransaction({
      ...base,
      transactionType: "cash_adjustment",
      cashDeltaPaise: 0,
      payments: []
    })).toThrow(/non-zero integer/);

    expect(() => validateCreateTransaction({
      ...base,
      transactionType: "cash_adjustment",
      cashDeltaPaise: 100,
      payments: [{ amountPaise: 100, method: "cash" }]
    })).toThrow(/cannot include payment allocations/);
  });

  it("builds the database RPC payload using snake_case and integer paise", () => {
    const payload = toCreateTransactionRpcPayload(base);
    expect(payload).toMatchObject({
      business_id: "business-123",
      transaction_type: "sale",
      amount_paise: 100_000,
      idempotency_key: "sale-unique-0001"
    });
    expect(payload.payments).toEqual([
      { amount_paise: 60_000, payment_method: "cash", payment_date: "2026-10-23", reference: null }
    ]);
  });

  it("accepts a negative cash adjustment without inventing a payment", () => {
    const result = validateCreateTransaction({
      ...base,
      transactionType: "cash_adjustment",
      cashDeltaPaise: -500,
      amountPaise: 0,
      payments: []
    });
    expect(result.outstandingPaise).toBe(0);
    expect(toCreateTransactionRpcPayload({
      ...base,
      transactionType: "cash_adjustment",
      cashDeltaPaise: -500,
      amountPaise: 0,
      payments: []
    }).amount_paise).toBe(500);
  });
});
