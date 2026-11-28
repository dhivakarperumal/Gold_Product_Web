import assert from "node:assert/strict";
import test from "node:test";
import { formatAmount, formatCompactCurrency, formatCurrency } from "../src/utils/currency.js";

test("rounds INR values to the nearest rupee and shows two decimal places", () => {
  assert.match(formatCurrency(35), /35\.00$/);
  assert.match(formatCurrency(1234.49), /1,234\.00$/);
  assert.match(formatCurrency(1234.5), /1,235\.00$/);
  assert.match(formatCurrency(1234.96), /1,235\.00$/);
  assert.equal(formatCurrency(219537.96), "₹2,19,538.00");
  assert.match(formatCurrency(0), /0\.00$/);
});

test("rounds plain amounts to the nearest rupee with two decimal places", () => {
  assert.equal(formatAmount(35), "35.00");
  assert.equal(formatAmount(1234.49), "1,234.00");
  assert.equal(formatAmount(1234.5), "1,235.00");
});

test("formats compact INR currency values for summary cards", () => {
  assert.equal(formatCompactCurrency(1000), "₹1K");
  assert.equal(formatCompactCurrency(12544), "₹12.5K");
});

test("shows a placeholder for missing or invalid amounts", () => {
  assert.equal(formatCurrency(null), "—");
  assert.equal(formatCurrency("invalid"), "—");
  assert.equal(formatAmount(undefined), "—");
});
