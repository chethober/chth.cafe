// The CHTH hub (the owner's private admin bot): the control plane reports landing visits that
// came from other CHTH products (?ref=) and deploys. Set HUB_URL and HUB_SECRET to switch it
// on; without them nothing is sent. The hub's own calls in (stats and the platform admin) are
// in internal.ts. Only counts leave: no account names or tokens.

import type { Context } from 'hono';
import { createReporter } from '../../src/chth-kit/hub.js';
import type { Bindings } from './shared';

export function track(c: Context<{ Bindings: Bindings } & any>, type: string, data: Record<string, unknown> = {}, user?: string) {
  const reporter = createReporter({ url: c.env.HUB_URL, secret: c.env.HUB_SECRET, source: 'cafe' });
  if (!reporter.enabled) return;
  const sent = reporter.track(type, data, user);
  try { c.executionCtx.waitUntil(sent); } catch { /* no execution context in tests */ }
}
