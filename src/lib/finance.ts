export type PaymentMethod = "cash" | "upi" | "bank" | "card" | "other";

export type TransactionType =
  | "sale"
  | "purchase"
  | "expense"
  | "customer_receipt"
  | "supplier_payment"
  | "sales_refund"
  | "purchase_return"
  | "other_income"
  | "cash_adjustment";

export type TransactionStatus = "draft" | "posted" | "void";

export interface Payment {
  amountPaise: number;
  method: PaymentMethod;
}

export interface FinanceTransaction {
  type: TransactionType;
  status: TransactionStatus;
  amountPaise: number;
  payments: Payment[];
  /** Required for cash_adjustment. Positive adds cash; negative removes cash. */
  cashDeltaPaise?: number;
}

export interface DailyFinanceSummary {
  salesPaise: number;
  collectionsPaise: number;
  expensesPaise: number;
  purchasesPaise: number;
  supplierPaymentsPaise: number;
  refundsPaise: number;
  otherIncomePaise: number;
  cashReceivedPaise: number;
  cashPaidPaise: number;
  expectedCashPaise: number;
  receivablesPaise: number;
  payablesPaise: number;
}

export interface DailyFinanceInput {
  openingCashPaise: number;
  receivablesPaise: number;
  payablesPaise: number;
  transactions: FinanceTransaction[];
}

const INCOMING_TYPES = new Set<TransactionType>([
  "sale",
  "customer_receipt",
  "purchase_return",
  "other_income"
]);

const OUTGOING_TYPES = new Set<TransactionType>([
  "purchase",
  "expense",
  "supplier_payment",
  "sales_refund"
]);

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer in paise`);
  }
}

function sumPayments(payments: Payment[]): number {
  return payments.reduce((total, payment) => {
    assertNonNegativeSafeInteger(payment.amountPaise, "payment.amountPaise");
    return total + payment.amountPaise;
  }, 0);
}

/**
 * Calculate a daily summary from posted transactions only.
 *
 * Important: sales are not the same as collections, and expenses are not the
 * same as all cash outflows. This function calculates an expected cash position,
 * not accounting profit. Input transactions must already be scoped to the
 * selected business and reporting period by the trusted caller.
 */
export function calculateDailyFinanceSummary(
  input: DailyFinanceInput
): DailyFinanceSummary {
  assertNonNegativeSafeInteger(input.openingCashPaise, "openingCashPaise");
  assertNonNegativeSafeInteger(input.receivablesPaise, "receivablesPaise");
  assertNonNegativeSafeInteger(input.payablesPaise, "payablesPaise");

  const summary: DailyFinanceSummary = {
    salesPaise: 0,
    collectionsPaise: 0,
    expensesPaise: 0,
    purchasesPaise: 0,
    supplierPaymentsPaise: 0,
    refundsPaise: 0,
    otherIncomePaise: 0,
    cashReceivedPaise: 0,
    cashPaidPaise: 0,
    expectedCashPaise: input.openingCashPaise,
    receivablesPaise: input.receivablesPaise,
    payablesPaise: input.payablesPaise
  };

  for (const transaction of input.transactions) {
    if (transaction.status !== "posted") continue;

    assertNonNegativeSafeInteger(transaction.amountPaise, "transaction.amountPaise");
    const paymentTotal = sumPayments(transaction.payments);

    if (paymentTotal > transaction.amountPaise &&
        transaction.type !== "customer_receipt" &&
        transaction.type !== "supplier_payment" &&
        transaction.type !== "cash_adjustment") {
      throw new Error("Payments cannot exceed the transaction amount");
    }

    if (transaction.type === "sale") {
      summary.salesPaise += transaction.amountPaise;
      summary.collectionsPaise += paymentTotal;
    } else if (transaction.type === "customer_receipt") {
      summary.collectionsPaise += paymentTotal;
    } else if (transaction.type === "expense") {
      summary.expensesPaise += transaction.amountPaise;
    } else if (transaction.type === "purchase") {
      summary.purchasesPaise += transaction.amountPaise;
    } else if (transaction.type === "supplier_payment") {
      summary.supplierPaymentsPaise += paymentTotal;
    } else if (transaction.type === "sales_refund") {
      summary.refundsPaise += transaction.amountPaise;
    } else if (transaction.type === "other_income") {
      summary.otherIncomePaise += transaction.amountPaise;
    }

    for (const payment of transaction.payments) {
      if (INCOMING_TYPES.has(transaction.type)) {
        summary.cashReceivedPaise += payment.method === "cash" ? payment.amountPaise : 0;
      } else if (OUTGOING_TYPES.has(transaction.type)) {
        summary.cashPaidPaise += payment.method === "cash" ? payment.amountPaise : 0;
      }
    }

    if (transaction.type === "cash_adjustment") {
      const delta = transaction.cashDeltaPaise;
      if (delta === undefined || !Number.isSafeInteger(delta)) {
        throw new Error("Posted cash adjustments require a safe-integer cashDeltaPaise");
      }
      if (delta > 0) summary.cashReceivedPaise += delta;
      if (delta < 0) summary.cashPaidPaise += Math.abs(delta);
    }
  }

  summary.expectedCashPaise =
    input.openingCashPaise + summary.cashReceivedPaise - summary.cashPaidPaise;

  for (const [key, value] of Object.entries(summary)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Calculated ${key} is invalid; check input amounts and cash movements`);
    }
  }

  return summary;
}

export function formatINRFromPaise(amountPaise: number): string {
  if (!Number.isSafeInteger(amountPaise)) {
    throw new Error("amountPaise must be a safe integer");
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amountPaise / 100);
}