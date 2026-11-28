const inrCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const inrAmountFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const compactInrCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

function numericValue(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function roundCurrencyAmount(value) {
  const number = numericValue(value);
  if (number == null) return null;
  return Math.sign(number) * Math.floor(Math.abs(number) + 0.5);
}

export function formatCurrency(value) {
  const number = numericValue(value);
  return number == null ? "—" : inrCurrencyFormatter.format(roundCurrencyAmount(number));
}

export function formatCompactCurrency(value) {
  const number = numericValue(value);
  return number == null ? "—" : compactInrCurrencyFormatter.format(number);
}

export function formatAmount(value) {
  const number = numericValue(value);
  return number == null ? "—" : inrAmountFormatter.format(roundCurrencyAmount(number));
}
