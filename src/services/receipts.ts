import type { Env } from '../server';
import { callTelegram, getTelegramConfig } from './telegram';
import { loyaltySettings, memberBalance } from './loyalty';
import { optionNames, type ReceiptData } from '../utils/receipt';

type Row = Record<string, any>;

/** Everything a receipt shows for one order, or null when the order is gone. */
export async function buildReceipt(db: D1Database, orderId: string): Promise<ReceiptData | null> {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<Row>();
  if (!order) return null;
  const settings = await db.prepare('SELECT cafe_name, address, contact_phone, currency, time_zone, tax_rate FROM settings WHERE id = ?').bind('cafe_config').first<Row>();
  const { results: lines } = await db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(orderId).all<Row>();
  let club: ReceiptData['club'] = null;
  if (order.customer_id) {
    const rules = await loyaltySettings(db);
    if (rules.enabled) {
      const balance = await memberBalance(db, order.customer_id);
      const earned = await db.prepare("SELECT COALESCE(SUM(stamps), 0) AS stamps, COALESCE(SUM(points), 0) AS points FROM customer_ledger WHERE order_id = ? AND kind = 'earn'").bind(orderId).first<Row>();
      club = { ...balance, stampsPerReward: rules.stampsPerReward, earnedStamps: Number(earned?.stamps || 0), earnedPoints: Number(earned?.points || 0) };
    }
  }
  return {
    cafeName: String(settings?.cafe_name || ''),
    address: String(settings?.address || ''),
    contactPhone: String(settings?.contact_phone || ''),
    currency: String(settings?.currency || ''),
    timeZone: String(settings?.time_zone || 'Asia/Tehran'),
    orderNumber: String(order.order_number),
    customerName: String(order.customer_name || ''),
    orderType: String(order.order_type),
    paymentMethod: String(order.payment_method),
    status: String(order.status),
    createdAt: String(order.createdAt),
    pickupAt: order.pickup_at || null,
    lines: lines.map(line => ({
      name: String(line.item_name), options: optionNames(line.variants_json), quantity: Number(line.quantity),
      unitPrice: Number(line.unit_price), discountAmount: Number(line.discount_amount || 0), total: Number(line.item_total)
    })),
    subtotal: Number(order.subtotal),
    discountAmount: Number(order.discount_amount || 0),
    taxAmount: Number(order.tax_amount),
    totalAmount: Number(order.total_amount),
    tipAmount: Number(order.tip_amount || 0),
    taxRate: Number(settings?.tax_rate || 0),
    club
  };
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))), byte => byte.toString(16).padStart(2, '0')).join('');
}

const ORDER_ID = /^(public|ord)-([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i;

/**
 * A Telegram /start payload that asks the café's bot for one order's receipt. Telegram allows 64 characters of
 * [A-Za-z0-9_-], so the order ID is packed and signed with a short MAC. Null for IDs that cannot be packed.
 */
export async function receiptStartPayload(orderId: string, secret: string) {
  const match = orderId.match(ORDER_ID);
  if (!match) return null;
  return `r${match[1] === 'public' ? 'p' : 'o'}${match.slice(2).join('').toLowerCase()}${(await hmacHex(secret, `receipt:${orderId}`)).slice(0, 16)}`;
}

export async function orderFromStartPayload(payload: string, secret: string) {
  const match = payload.match(/^r([po])([0-9a-f]{32})([0-9a-f]{16})$/);
  if (!match) return null;
  const hex = match[2];
  const id = `${match[1] === 'p' ? 'public' : 'ord'}-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return (await hmacHex(secret, `receipt:${id}`)).slice(0, 16) === match[3] ? id : null;
}

/** The bot's @username, asked of Telegram once a day per token. */
async function botUsername(env: Env['Bindings'], botToken: string) {
  const key = `telegram:username:${(await hmacHex('bot-username', botToken)).slice(0, 16)}`;
  const cached = env.KV ? await env.KV.get(key) : null;
  if (cached !== null) return cached;
  const me = await callTelegram<{ username?: string }>(botToken, 'getMe', {});
  const username = me.success && me.result?.username ? me.result.username : '';
  // A failed lookup is remembered briefly too, so receipts do not wait on an unreachable API every time.
  if (env.KV) await env.KV.put(key, username, { expirationTtl: me.success ? 86400 : 600 });
  return username;
}

/** A t.me link that opens the café's bot and sends it this order's receipt, or null without a bot. */
export async function telegramReceiptLink(env: Env['Bindings'], orderId: string) {
  if (!env.SESSION_SECRET || !env.DB) return null;
  const config = await getTelegramConfig(env);
  if (!config.botToken) return null;
  const [payload, username] = await Promise.all([receiptStartPayload(orderId, env.SESSION_SECRET), botUsername(env, config.botToken).catch(() => '')]);
  return payload && username ? `https://t.me/${username}?start=${payload}` : null;
}
