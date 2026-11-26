import assert from "node:assert/strict";
import test from "node:test";
import { getDiscountPercentage } from "../src/utils/productPricing.js";

test("derives a valid displayed discount from the actual price and MRP", () => {
  assert.equal(getDiscountPercentage({
    mrp: 249600,
    offer_price: 244608,
    discount: 4992
  }), 2);
});

test("returns zero when no price reduction is available", () => {
  assert.equal(getDiscountPercentage({ mrp: 1000, offer_price: 1000, discount: 500 }), 0);
  assert.equal(getDiscountPercentage({ mrp: 1000, offer_price: 1200 }), 0);
});

test("bounds percentage output and ignores invalid pricing values", () => {
  assert.equal(getDiscountPercentage({ mrp: 1000, offer_price: -1 }), 0);
  assert.equal(getDiscountPercentage({ mrp: 1000, offer_price: 0 }), 100);
  assert.equal(getDiscountPercentage({ mrp: "invalid", offer_price: 100 }), 0);
});
