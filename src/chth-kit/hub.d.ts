// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
export const MAX_SKEW_SECONDS: number;
export function safeEqual(a: string, b: string): boolean;
export function signature(secret: string, timestamp: string, method: string, path: string, body?: string): Promise<string>;
export function signedHeaders(opts: { source: string; secret: string; method?: string; url: string; body?: string; now?: number }): Promise<Record<string, string>>;
export function verifySigned(request: Request, secretFor: (source: string) => string | null | undefined | Promise<string | null | undefined>, now?: number):
  Promise<{ source: string; body: string; signature: string; timestamp: number } | null>;
export function pseudonym(secret: string, id: string | number): Promise<string>;
export interface Reporter {
  enabled: boolean;
  track(type: string, data?: Record<string, unknown>, user?: string | number): Promise<boolean>;
  batch(list: { type: string; data?: Record<string, unknown>; user?: string | number }[]): Promise<boolean>;
}
export function createReporter(cfg: { url?: string; source: string; secret?: string; fetch?: typeof fetch }): Reporter;
export function startSource(param: unknown): string | null;
