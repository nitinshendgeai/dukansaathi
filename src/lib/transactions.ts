import type { PaymentMethod, TransactionType } from "./finance";

export interface TransactionPaymentInput {
  amountPaise: number;
  method: PaymentMethod;
  paymentDate?: string;
  reference?: string;
}

export interface CreateTransactionInput {
  businessId: string;
  transactionType: TransactionType;
  businessDate: string;
  amountPaise: number;
  idempotencyKey: string;
  partyId?: string;
  notes?: string;
  cashDeltaPaise?: number;
  payments: TransactionPaymentInput[];
}

export interface ValidatedTransactionInput extends CreateTransactionInput {
  paymentTotalPaise: number;
  outstandingPaise: number;
}

const TYPES: readonly TransactionType[] = [
  "sale",
  "purchase",
  "expense",
  "customer_receipt",
  "supplier_payment",
  "sales_refund",
  "purchase_return",
  "other_income",
  "cash_adjustment"
];

const METHODS: readonly PaymentMethod[] = ["cash", "upi", "bank", "card", "other"];
const SETTLEMENT_TYPES = new Set<TransactionType>(["customer_receipt", "supplier_payment"]);

function requireText(value: string, name: string, maxLength: number): void {
  if (!value.trim() || value.length > maxLength) {
    throw new Error(`${name} is required and must be at most ${maxLength} characters`);
  }
}

function requirePaise(value: number, name: string, allowZero = false): void {
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new Error(`${name} must be a ${allowZero ? "non-negative" : "positive"} safe integer in paise`);
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Validate a transaction before sending it to the trusted database RPC.
 * This is a UX/domain guard, not a replacement for server-side validation/RLS.
 */
export function validateCreateTransaction(
  input: CreateTransactionInput
): ValidatedTransactionInput {
  requireText(input.businessId, "businessId", 100);
  requireText(input.idempotencyKey, "idempotencyKey", 200);
  if (input.idempotencyKey.trim().length < 8) {
    throw new Error("idempotencyKey must contain at least 8 characters");
  }
  if (!TYPES.includes(input.transactionType)) {
    throw new Error("Unsupported transaction type");
  }
  if (!isIsoDate(input.businessDate)) {
    throw new Error("businessDate must be a valid YYYY-MM-DD date");
  }
  if (!Array.isArray(input.payments)) {
    throw new Error("payments must be an array");
  }

  if (input.transactionType === "cash_adjustment") {
    if (!Number.isSafeInteger(input.cashDeltaPaise) || input.cashDeltaPaise === 0) {
      throw new Error("Cash adjustment requires a non-zero integer cashDeltaPaise");
    }
    if (input.payments.length !== 0) {
      throw new Error("Cash adjustments cannot include payment allocations");
    }
  } else {
    requirePaise(input.amountPaise, "amountPaise");
  }

  let paymentTotalPaise = 0;
  for (const [index, payment] of input.payments.entries()) {
    requirePaise(payment.amountPaise, `payments[${index}].amountPaise`);
    if (!METHODS.includes(payment.method)) {
      throw new Error(`payments[${index}].method is unsupported`);
    }
    if (payment.paymentDate && !isIsoDate(payment.paymentDate)) {
      throw new Error(`payments[${index}].paymentDate must be YYYY-MM-DD`);
    }
    if (payment.reference && payment.reference.length > 160) {
      throw new Error(`payments[${index}].reference must be at most 160 characters`);
    }
    paymentTotalPaise += payment.amountPaise;
    if (!Number.isSafeInteger(paymentTotalPaise)) {
      throw new Error("Payment total exceeds safe integer range");
    }
  }

  const transactionAmount = input.transactionType === "cash_adjustment"
    ? Math.abs(input.cashDeltaPaise as number)
    : input.amountPaise;

  if (SETTLEMENT_TYPES.has(input.transactionType) && paymentTotalPaise !== transactionAmount) {
    throw new Error("Receipt/payment allocations must equal the transaction amount");
  }
  if (input.transactionType !== "cash_adjustment" &&
      !SETTLEMENT_TYPES.has(input.transactionType) &&
      paymentTotalPaise > transactionAmount) {
    throw new Error("Payment allocations cannot exceed the transaction amount");
  }

  if (input.partyId !== undefined) requireText(input.partyId, "partyId", 100);
  if (input.notes && input.notes.length > 2000) {
    throw new Error("notes must be at most 2000 characters");
  }

  return {
    ...input,
    paymentTotalPaise,
    outstandingPaise: input.transactionType === "cash_adjustment"
      ? 0
      : Math.max(0, transactionAmount - paymentTotalPaise)
  };
}

export function toCreateTransactionRpcPayload(input: CreateTransactionInput): Record<string, unknown> {
  const validated = validateCreateTransaction(input);
  return {
    business_id: validated.businessId,
    transaction_type: validated.transactionType,
    business_date: validated.businessDate,
    amount_paise: validated.transactionType === "cash_adjustment"
      ? Math.abs(validated.cashDeltaPaise as number)
      : validated.amountPaise,
    cash_delta_paise: validated.cashDeltaPaise ?? null,
    party_id: validated.partyId ?? null,
    idempotency_key: validated.idempotencyKey,
    notes: validated.notes ?? null,
    payments: validated.payments.map((payment) => ({
      amount_paise: payment.amountPaise,
      payment_method: payment.method,
      payment_date: payment.paymentDate ?? validated.businessDate,
      reference: payment.reference ?? null
    }))
  };
}
