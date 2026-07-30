import { test } from "node:test";
import assert from "node:assert/strict";
import { dividendDiscountValue, comparablesValue, dcfValue, computeValuations } from "./valuation.js";

test("dividendDiscountValue computes Gordon growth estimate", () => {
  const result = dividendDiscountValue("1.00");
  assert.ok(result);
  // d1 = 1.00 * 1.03 = 1.03; estimate = 1.03 / (0.08 - 0.03) = 20.60
  assert.equal(result.estimate, "20.60");
  assert.equal(result.method, "dividend_discount");
});

test("dividendDiscountValue returns null for non-payers", () => {
  assert.equal(dividendDiscountValue(null), null);
  assert.equal(dividendDiscountValue("0"), null);
  assert.equal(dividendDiscountValue("None" as never), null);
});

test("comparablesValue multiplies EPS by the benchmark P/E", () => {
  const result = comparablesValue("5.00");
  assert.ok(result);
  assert.equal(result.estimate, "100.00");
  assert.equal(result.method, "comparables");
});

test("comparablesValue returns null for missing or non-positive EPS", () => {
  assert.equal(comparablesValue(undefined), null);
  assert.equal(comparablesValue("-1.00"), null);
});

test("dcfValue computes per-share value from company-level FCF and share count", () => {
  const result = dcfValue("1000000", "100000");
  assert.ok(result);
  // fcf1 = 1,000,000 * 1.04 = 1,040,000; EV = 1,040,000 / (0.09 - 0.04) = 20,800,000; /100,000 shares = 208.00
  assert.equal(result.estimate, "208.00");
  assert.equal(result.method, "dcf");
});

test("dcfValue returns null when either input is missing", () => {
  assert.equal(dcfValue(null, "100000"), null);
  assert.equal(dcfValue("1000000", null), null);
});

test("computeValuations omits methods with insufficient data instead of guessing", () => {
  const results = computeValuations({
    eps: "5.00",
    dividendPerShare: null,
    sharesOutstanding: null,
    freeCashFlow: null,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.method, "comparables");
});

test("computeValuations returns all three when every input is available", () => {
  const results = computeValuations({
    eps: "5.00",
    dividendPerShare: "1.00",
    sharesOutstanding: "100000",
    freeCashFlow: "1000000",
  });
  assert.equal(results.length, 3);
});
