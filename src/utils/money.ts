// How the café's currency is written: the symbol's place and how many decimals it shows.
// Shared by the menu, the workspace and the Worker (Telegram), so an amount reads the same everywhere.

/** Currencies the settings offer as one-tap choices. */
export const COMMON_CURRENCIES = ['₹', '$', '€', '£', 'تومان'] as const;

/** Iranian toman and rial: whole amounts only. */
const WHOLE_ONLY = new Set(['تومان', 'ریال', '﷼', 'IRT', 'IRR', 'Toman', 'toman']);

/** Symbols written after the amount, with a space: تومان, ریال and other words in Persian or Arabic script, and IRT/IRR. */
const isSuffix = (currency: string) => WHOLE_ONLY.has(currency) || /^[؀-ۿ]/.test(currency);

export const currencyDecimals = (currency: string) => (WHOLE_ONLY.has(currency.trim()) ? 0 : 2);

/** Puts the currency on the amount's text, before (₹120.00) or after (120,000 تومان) it. */
export function withCurrency(amountText: string, currency: string, negative = false): string {
  const symbol = currency.trim();
  const sign = negative ? '−' : '';
  if (!symbol) return `${sign}${amountText}`;
  return isSuffix(symbol) ? `${sign}${amountText} ${symbol}` : `${sign}${symbol}${amountText}`;
}

const formatters = new Map<string, Intl.NumberFormat>();
function grouped(decimals: number, trimZeros: boolean) {
  const key = `${decimals}:${trimZeros}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: trimZeros ? 0 : decimals, maximumFractionDigits: decimals });
    formatters.set(key, f);
  }
  return f;
}

/**
 * An amount in the café's currency with grouping: ₹1,284.50, −$3.00, 120,000 تومان.
 * `trimZeros` drops ".00" on whole amounts (the public menu's prices).
 */
export function formatMoney(value: number, currency: string, { trimZeros = false } = {}): string {
  const amount = Number(value) || 0;
  const decimals = currencyDecimals(currency);
  const rounded = decimals === 0 ? Math.round(Math.abs(amount)) : Math.abs(amount);
  return withCurrency(grouped(decimals, trimZeros).format(rounded), currency, amount < 0 && rounded !== 0);
}
