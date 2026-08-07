/**
 * Rounds `value` to `decimals` places, half-away-from-zero — matching Java's
 * `BigDecimal.setScale(decimals, RoundingMode.HALF_UP)` used throughout the Android app's money
 * math. Plain `Math.round(value * 10**decimals) / 10**decimals` misrounds cases like 2.345 (whose
 * float64 representation is actually 2.34499999999999975..., rounding down to 2.34 instead of
 * 2.35) — routing through exponential-notation string conversion sidesteps that intermediate
 * multiplication error.
 */
export function halfUpRound(value, decimals = 0) {
  const sign = value < 0 ? -1 : 1;
  const shifted = Number(`${Math.abs(value)}e${decimals}`);
  const rounded = Math.round(shifted);
  return sign * Number(`${rounded}e-${decimals}`);
}
