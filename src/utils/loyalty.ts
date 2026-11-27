/**
 * The customer club's stamp card and points. Members earn when an order linked to them is completed:
 * a stamp for every paid item in the stamp categories, and a point for every `spendPerPoint` of the total.
 * A full card is a free item; points come off an order at `pointValue` each.
 */
export interface LoyaltySettings {
  enabled: boolean;
  /** Stamps for one free item, or 0 for no stamp card. */
  stampsPerReward: number;
  /** Categories whose items earn stamps and can be the free item; empty for every category. */
  stampCategoryIds: string[];
  /** Money spent for one point, or 0 for no points. */
  spendPerPoint: number;
  /** What one point takes off an order. */
  pointValue: number;
}

export const DEFAULT_LOYALTY: LoyaltySettings = { enabled: false, stampsPerReward: 8, stampCategoryIds: [], spendPerPoint: 0, pointValue: 0 };

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const clampNumber = (value: unknown, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Number(n.toFixed(4))) : 0;
};

export function parseLoyalty(raw: unknown): LoyaltySettings {
  let value: Record<string, unknown> = {};
  if (typeof raw === 'string') { try { value = JSON.parse(raw) || {}; } catch { value = {}; } }
  else if (raw && typeof raw === 'object') value = raw as Record<string, unknown>;
  return {
    enabled: value.enabled === true,
    stampsPerReward: clampInt(value.stampsPerReward ?? DEFAULT_LOYALTY.stampsPerReward, 0, 50, DEFAULT_LOYALTY.stampsPerReward),
    stampCategoryIds: Array.isArray(value.stampCategoryIds) ? [...new Set(value.stampCategoryIds.filter((id): id is string => typeof id === 'string'))].slice(0, 100) : [],
    spendPerPoint: clampNumber(value.spendPerPoint, 1e12),
    pointValue: clampNumber(value.pointValue, 1e9)
  };
}

export const stampsOn = (settings: LoyaltySettings) => settings.enabled && settings.stampsPerReward > 0;
export const pointsOn = (settings: LoyaltySettings) => settings.enabled && settings.spendPerPoint > 0 && settings.pointValue > 0;

export function earnsStamps(settings: LoyaltySettings, categoryId: string | undefined) {
  return stampsOn(settings) && (!settings.stampCategoryIds.length || (!!categoryId && settings.stampCategoryIds.includes(categoryId)));
}

/** Stamps for one line: its paid units, so a free or fully discounted unit earns nothing. */
export function lineStamps(line: { quantity: number; unitPrice: number; itemTotal: number }) {
  if (line.unitPrice <= 0 || line.itemTotal <= 0) return 0;
  return Math.max(0, Math.min(line.quantity, Math.round(line.itemTotal / line.unitPrice)));
}

export const orderPoints = (settings: LoyaltySettings, total: number) => pointsOn(settings) ? Math.max(0, Math.floor(total / settings.spendPerPoint + 1e-9)) : 0;

/** The free items a member can claim now, and the stamps on their current card. */
export function stampProgress(settings: LoyaltySettings, stamps: number) {
  const per = Math.max(1, settings.stampsPerReward);
  return { rewards: Math.floor(Math.max(0, stamps) / per), onCard: Math.max(0, stamps) % per, per };
}
