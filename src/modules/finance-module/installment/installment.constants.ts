/**
 * Installment plan constants & platform guardrails.
 * All values are in kobo unless stated otherwise.
 */

export interface InstallmentPreset {
  id: string;
  name: string;
  count: number;
  /** Days between installments (installment 1 is charged immediately as deposit). */
  interval_days: number;
}

/** Platform-defined presets — vendor picks a subset per product. */
export const INSTALLMENT_PRESETS: InstallmentPreset[] = [
  {
    id: 'fifty-fifty-2wk',
    name: '50/50 · 2 weeks',
    count: 2,
    interval_days: 7,
  },
  { id: 'thirds-3wk', name: '33/33/34 · 3 weeks', count: 3, interval_days: 7 },
  { id: 'quarters-4wk', name: '25% × 4 · 4 weeks', count: 4, interval_days: 7 },
  { id: 'half-2mo', name: '50/50 · 2 months', count: 2, interval_days: 30 },
  { id: 'thirds-3mo', name: '33/33/34 · 3 months', count: 3, interval_days: 30 },
  { id: 'quarters-4mo', name: '25% × 4 · 4 months', count: 4, interval_days: 30 },
];

export const INSTALLMENT_DEFAULT_PRESET = 'fifty-fifty-2wk';

/** Default subset offered when a vendor enables installment with no selection. */
export const INSTALLMENT_DEFAULT_PRESETS = ['fifty-fifty-2wk'];

/** ─── Platform guardrails ─── */

/** Minimum order value (kobo) before a plan is allowed (₦20,000). */
export const INSTALLMENT_MIN_ORDER_KOBO = 2_000_000;

/** Maximum number of concurrently active plans per buyer. */
export const INSTALLMENT_MAX_CONCURRENT_PLANS = 3;

/** Days a buyer with a defaulted plan is locked out of new plans. */
export const INSTALLMENT_DEFAULT_LOCKOUT_DAYS = 90;

/** Reservation for an unpaid deposit is released after this long (24h). */
export const INSTALLMENT_DEPOSIT_EXPIRY_HOURS = 24;

/** ─── Default ladder (missed-payment lifecycle) ─── */

/** Days past due when warning 1 is sent. */
export const INSTALLMENT_WARNING_1_DAYS = 2;

/** Days past due when warning 2 (final) is sent. */
export const INSTALLMENT_WARNING_2_DAYS = 5;

/** Days past due when the plan is defaulted, refunded and unlocked. */
export const INSTALLMENT_DEFAULT_DAYS = 7;

/** Auto-charge retry attempts during the grace period (1 per day). */
export const INSTALLMENT_AUTO_CHARGE_RETRIES = 3;

/** Order note tag marking installment orders. */
export const INSTALLMENT_ORDER_MARKER = 'installment_order';

/** Paystack reference prefix for installment charges. */
export const INSTALLMENT_REFERENCE_PREFIX = 'inst_';

/** Generates the per-installment amounts (kobo) from a total (remainder goes to the first installment). */
export function buildInstallmentAmounts(
  totalKobo: number,
  count: number,
): number[] {
  const base = Math.floor(totalKobo / count);
  const amounts: number[] = [];
  let remaining = totalKobo;
  for (let i = 0; i < count; i += 1) {
    if (i === count - 1) {
      amounts.push(remaining);
    } else {
      amounts.push(base);
      remaining -= base;
    }
  }
  return amounts;
}

export function buildInstallmentDueDates(
  startDate: Date,
  count: number,
  intervalDays: number,
): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + intervalDays * i);
    return date;
  });
}
