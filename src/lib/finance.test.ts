import { describe, expect, it } from "vitest";
import { calculateDailyFinanceSummary, formatINRFromPaise } from "./finance";

describe("calculateDailyFinanceSummary", () => {
  it("keeps sales separate from collections and cash received", () => {
    const summary = calculateDailyFinanceSummary({
      openingCashPaise: 10_000,
      receivablesPaise: 50_000,
      payablesPaise: 20_000,
      transactions: [
        {
          type: "sale",
          status: "posted",
          amountPaise: 100_000,
          payments: [
            { amountPaise: 40_000, method: "cash" },
            { amountPaise: 20_000, method: "upi" }
          ]
        }
      ]
    });

    expect(summary.salesPaise).toBe(100_000);
    expect(summary.collectionsPaise).toBe(60_000);
    expect(summary.cashReceivedPaise).toBe(40_000);
    expect(summary.expectedCashPaise).toBe(50_000);
    expect(summary.receivablesPaise).toBe(50_000);
  });

  it("includes customer receipts without counting them as new sales", () => {
    const summary = calculateDailyFinanceSummary({
      openingCashPaise: 0,
      receivablesPaise: 0,
      payablesPaise: 0,
      transactions: [{
        type: "customer_receipt",
        status: "posted",
        amountPaise: 25_000,
        payments: [{ amountPaise: 25_000, method: "cash" }]
      }]
    });

    expect(summary.salesPaise).toBe(0);
    expect(summary.collectionsPaise).toBe(25_000);
    expect(summary.expectedCashPaise).toBe(25_000);
  });

  it("does not include draft or void transactions", () => {
    const summary = calculateDailyFinanceSummary({
      openingCashPaise: 50_000,
      receivablesPaise: 0,
      payablesPaise: 0,
      transactions: [
        { type: "sale", status: "draft", amountPaise: 10_000, payments: [{ amountPaise: 10_000, method: "cash" }] },
        { type: "expense", status: "void", amountPaise: 2_000, payments: [{ amountPaise: 2_000, method: "cash" }] }
      ]
    });

    expect(summary.salesPaise).toBe(0);
    expect(summary.expensesPaise).toBe(0);
    expect(summary.expectedCashPaise).toBe(50_000);
  });

  it("treats a supplier payment as cash outflow, not a new expense", () => {
    const summary = calculateDailyFinanceSummary({
      openingCashPaise: 100_000,
      receivablesPaise: 0,
      payablesPaise: 50_000,
      transactions: [{
        type: "supplier_payment",
        status: "posted",
        amountPaise: 30_000,
        payments: [{ amountPaise: 30_000, method: "cash" }]
      }]
    });

    expect(summary.expensesPaise).toBe(0);
    expect(summary.supplierPaymentsPaise).toBe(30_000);
    expect(summary.cashPaidPaise).toBe(30_000);
    expect(summary.expectedCashPaise).toBe(70_000);
  });

  it("rejects negative or fractional paise inputs", () => {
    expect(() => calculateDailyFinanceSummary({
      openingCashPaise: -1,
      receivablesPaise: 0,
      payablesPaise: 0,
      transactions: []
    })).toThrow(/openingCashPaise/);

    expect(() => calculateDailyFinanceSummary({
      openingCashPaise: 0,
      receivablesPaise: 0,
      payablesPaise: 0,
      transactions: [{ type: "expense", status: "posted", amountPaise: 100.5, payments: [] }]
    })).toThrow(/transaction.amountPaise/);
  });

  it("allows negative expected cash so reconciliation can expose a mistake", () => {
    const summary = calculateDailyFinanceSummary({
      openingCashPaise: 0,
      receivablesPaise: 0,
      payablesPaise: 0,
      transactions: [{
        type: "expense",
        status: "posted",
        amountPaise: 500,
        payments: [{ amountPaise: 500, method: "cash" }]
      }]
    });

    expect(summary.expectedCashPaise).toBe(-500);
  });

  it("rejects payment totals greater than a customer receipt amount", () => {
    expect(() => calculateDailyFinanceSummary({
      openingCashPaise: 0,
      receivablesPaise: 0,
      payablesPaise: 0,
      transactions: [{
        type: "customer_receipt",
        status: "posted",
        amountPaise: 100,
        payments: [{ amountPaise: 101, method: "cash" }]
      }]
    })).toThrow(/Payments cannot exceed/);
  });

  it("formats integer paise as INR", () => {
    expect(formatINRFromPaise(123456)).toContain("1,234.56");
  });
});