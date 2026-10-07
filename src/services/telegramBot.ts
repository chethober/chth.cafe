import type { Hono } from 'hono';
import type { Env } from '../server';
import { cafeDate, ensureFeatureTables } from './operations';
import { getOpeningStatus } from '../utils/openingHours';
import {
  callTelegram, cafeTime, escapeHtml, formatDailyFinancialReportMessage, formatSaleMessage, getTelegramConfig, money,
  orderKeyboard, ORDER_STATUS_LABEL, sendTelegramMessage,
  type DailyStats, type FormatContext, type InlineKeyboard, type TelegramConfig, type TelegramMessage
} from './telegram';

type Bindings = Env['Bindings'];
type Row = Record<string, any>;

const COMMANDS: { command: string; description: string }[] = [
  { command: 'today', description: 'Sales, expenses and top sellers so far today' },
  { command: 'orders', description: 'Open orders, with buttons to move them along' },
  { command: 'stock', description: 'Ingredients at or below their reorder level' },
  { command: 'restock', description: 'Record a purchase: /restock milk 12' },
  { command: 'menu', description: 'Find a menu item and mark it sold out or back' },
  { command: 'soldout', description: 'Menu items currently marked sold out' },
  { command: 'staff', description: 'Who is clocked in right now' },
  { command: 'tasks', description: 'Open checklist tasks, tap to complete' },
  { command: 'expense', description: 'Log a cash expense: /expense 250 milk' },
  { command: 'week', description: 'Revenue for the last 7 days' },
  { command: 'report', description: 'Daily report: /report or /report 2026-10-01' },
  { command: 'status', description: 'Is the café open right now?' },
  { command: 'alerts', description: 'Turn notifications on or off' },
  { command: 'chatid', description: 'Show this chat’s ID' },
  { command: 'help', description: 'List commands' },
];

const ALERTS: { key: keyof TelegramConfig; column: string; label: string }[] = [
  { key: 'notifySales', column: 'notify_sales', label: 'Sales' },
  { key: 'notifyShifts', column: 'notify_shifts', label: 'Clock in and out' },
  { key: 'notifyTasks', column: 'notify_tasks', label: 'Checklist completed' },
  { key: 'notifyDailyReport', column: 'notify_daily_report', label: 'Daily summary' },
  { key: 'notifyLowStock', column: 'notify_low_stock', label: 'Low stock' },
];

// --- Date helpers (all in the café's timezone) ---

export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

function localHour(now: Date, timeZone: string) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now));
}

/** Orders whose café-local date falls in [from, to]. A padded UTC range keeps the query indexed. */
async function ordersBetween(db: D1Database, from: string, to: string, timeZone: string) {
  const { results } = await db.prepare('SELECT * FROM orders WHERE createdAt >= ? AND createdAt < ?').bind(addDays(from, -1), addDays(to, 2)).all<Row>();
  return results.filter(o => { const day = cafeDate(new Date(o.createdAt), timeZone); return day >= from && day <= to; });
}

export async function dailyStats(db: D1Database, date: string, timeZone: string): Promise<DailyStats> {
  const orders = await ordersBetween(db, date, date, timeZone);
  const completed = orders.filter(o => o.status === 'completed');
  const completedIds = new Set(completed.map(o => o.id));
  const { results: expenses } = await db.prepare('SELECT amount FROM expenses WHERE substr(date, 1, 10) = ?').bind(date).all<Row>();
  const { results: lines } = await db.prepare(
    'SELECT oi.order_id, oi.item_name, oi.quantity, oi.item_total FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.createdAt >= ? AND o.createdAt < ?'
  ).bind(addDays(date, -1), addDays(date, 2)).all<Row>();

  const sum = (rows: Row[]) => rows.reduce((total, o) => total + Number(o.total_amount || 0), 0);
  const byMethod = (method: string) => sum(completed.filter(o => o.payment_method === method));
  const totalRevenue = sum(completed);
  const totalExpenses = expenses.reduce((total, e) => total + Number(e.amount || 0), 0);
  const items = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const line of lines) {
    if (!completedIds.has(line.order_id)) continue;
    const item = items.get(line.item_name) || { name: line.item_name, quantity: 0, revenue: 0 };
    item.quantity += Number(line.quantity || 0);
    item.revenue += Number(line.item_total || 0);
    items.set(line.item_name, item);
  }
  const cashTotal = byMethod('cash'), cardTotal = byMethod('card'), qrTotal = byMethod('qr_pay');

  return {
    dateStr: date,
    totalRevenue,
    totalOrders: completed.length,
    cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    cashTotal, cardTotal, qrTotal,
    otherTotal: totalRevenue - cashTotal - cardTotal - qrTotal,
    topItems: [...items.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5),
  };
}

/** Send the daily report for a café date (defaults to today) if daily reports are enabled. */
export async function sendDailyReport(env: Bindings, date?: string, force = false): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getTelegramConfig(env);
    if (!config.botToken || !config.chatId) return { success: false, error: 'Telegram bot not configured (missing token or chat ID)' };
    if (!env?.DB) return { success: false, error: 'The café database is not configured.' };
    if (!force && !config.notifyDailyReport) return { success: true };
    const stats = await dailyStats(env.DB, date || cafeDate(new Date(), config.timeZone), config.timeZone);
    return await sendTelegramMessage(config.botToken, config.chatId, formatDailyFinancialReportMessage(stats, config));
  } catch (err: any) {
    console.error('[Daily Financial Report Error]:', err);
    return { success: false, error: err.message || 'Failed to send daily financial report' };
  }
}

async function lowStockItems(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM stock_items WHERE quantity <= min_threshold ORDER BY quantity / MAX(min_threshold, 0.000001), name').all<Row>();
  return results;
}

function lowStockView(items: Row[], heading: string): TelegramMessage {
  if (!items.length) return { text: '✅ <b>All ingredients are above their reorder level.</b>' };
  const lines = items.slice(0, 40).map(item => {
    const icon = Number(item.quantity) <= 0 ? '🔴' : '🟠';
    return `${icon} <b>${escapeHtml(item.name)}</b> — ${Number(item.quantity).toFixed(2)} / ${Number(item.min_threshold).toFixed(2)} ${escapeHtml(item.unit)}`;
  });
  const more = items.length > 40 ? `\n…and ${items.length - 40} more` : '';
  return { text: `${heading}\n\n${lines.join('\n')}${more}\n\n<i>Record a delivery with /restock name quantity</i>` };
}

/**
 * Called from the Worker's cron trigger. Each job is keyed in KV so an hourly cron sends it once:
 * yesterday's report after café-local midnight, and a low-stock digest from 09:00 café time.
 */
export async function runScheduledTelegram(env: Bindings, now = new Date()) {
  const config = await getTelegramConfig(env);
  if (!config.botToken || !config.chatId || !env?.DB) return;
  await ensureFeatureTables(env.DB);
  const today = cafeDate(now, config.timeZone);
  const hour = localHour(now, config.timeZone);
  const once = async (key: string, due: boolean, job: () => Promise<{ success: boolean }>) => {
    if (!due) return;
    if (!env.KV) { if (hour === 0) await job(); return; }
    if (await env.KV.get(key)) return;
    if ((await job()).success) await env.KV.put(key, '1', { expirationTtl: 3 * 86400 });
  };
  await once(`telegram:daily:${addDays(today, -1)}`, config.notifyDailyReport, () => sendDailyReport(env, addDays(today, -1)));
  await once(`telegram:stock:${today}`, config.notifyLowStock && hour >= 9, async () => {
    const items = await lowStockItems(env.DB);
    if (!items.length) return { success: true };
    return sendTelegramMessage(config.botToken, config.chatId, lowStockView(items, '🌅 <b>Morning stock check</b>').text);
  });
}

// --- Webhook security ---

export async function webhookSecret(sessionSecret: string, botToken: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(sessionSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`telegram-webhook:${botToken}`));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

// --- Views. Each returns a message so button presses can redraw it in place. ---

async function orderView(db: D1Database, id: string, ctx: FormatContext): Promise<TelegramMessage | null> {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Row>();
  if (!order) return null;
  const { results: items } = await db.prepare('SELECT item_name, quantity, item_total FROM order_items WHERE order_id = ?').bind(id).all<Row>();
  return formatSaleMessage(
    { id: order.id, orderNumber: order.order_number, customerName: order.customer_name, orderType: order.order_type, totalAmount: order.total_amount, paymentMethod: order.payment_method, status: order.status, createdAt: order.createdAt },
    items.map(i => ({ itemName: i.item_name, quantity: i.quantity, itemTotal: i.item_total })),
    ctx
  );
}

async function openOrdersView(db: D1Database, ctx: FormatContext): Promise<TelegramMessage> {
  const { results } = await db.prepare("SELECT * FROM orders WHERE status IN ('pending','preparing','ready') ORDER BY createdAt LIMIT 15").all<Row>();
  if (!results.length) return { text: '☕️ <b>No open orders.</b>' };
  const lines = results.map(o => `• <b>${escapeHtml(o.order_number)}</b> ${escapeHtml(o.customer_name)} — ${money(ctx, o.total_amount)} · ${ORDER_STATUS_LABEL[o.status]} · ${cafeTime(ctx, o.createdAt)}`);
  const keyboard: InlineKeyboard = results.flatMap(o => {
    const [row] = orderKeyboard({ id: o.id, status: o.status });
    return row ? [[{ ...row[0], text: `${o.order_number} → ${row[0].text}`, callback_data: row[0].callback_data.replace(/^os:/, 'ol:') }]] : [];
  });
  return { text: `🧾 <b>Open orders (${results.length})</b>\n\n${lines.join('\n')}`, keyboard };
}

async function tasksView(db: D1Database): Promise<TelegramMessage> {
  const { results } = await db.prepare(
    "SELECT * FROM tasks WHERE status != 'completed' ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at LIMIT 20"
  ).all<Row>();
  if (!results.length) return { text: '✅ <b>Every checklist task is done.</b>' };
  const flag = (p: string) => p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '⚪️';
  const lines = results.map(t => `${flag(t.priority)} <b>${escapeHtml(t.title)}</b> · ${escapeHtml(t.category)}`);
  const keyboard = results.filter(t => `ts:${t.id}`.length <= 64).map(t => [{ text: `✅ ${String(t.title).slice(0, 40)}`, callback_data: `ts:${t.id}` }]);
  return { text: `📋 <b>Open tasks (${results.length})</b>\n\n${lines.join('\n')}`, keyboard };
}

function menuItemsView(items: Row[], heading: string, ctx: FormatContext): TelegramMessage {
  const lines = items.map(i => `${i.is_in_stock ? '🟢' : '⛔️'} <b>${escapeHtml(i.name)}</b> — ${money(ctx, i.base_price)}`);
  const keyboard = items.filter(i => `mi:${i.id}:0`.length <= 64).map(i => [{
    text: i.is_in_stock ? `⛔️ Sold out: ${String(i.name).slice(0, 36)}` : `🟢 Back on: ${String(i.name).slice(0, 36)}`,
    callback_data: `mi:${i.id}:${i.is_in_stock ? 0 : 1}`,
  }]);
  return { text: `${heading}\n\n${lines.join('\n')}`, keyboard };
}

async function soldOutView(db: D1Database, ctx: FormatContext): Promise<TelegramMessage> {
  const { results } = await db.prepare('SELECT * FROM menu_items WHERE is_in_stock = 0 ORDER BY name LIMIT 30').all<Row>();
  if (!results.length) return { text: '🟢 <b>Everything on the menu is available.</b>\n\nUse /menu name to mark something sold out.' };
  return menuItemsView(results, `⛔️ <b>Sold out (${results.length})</b>`, ctx);
}

function alertsView(config: TelegramConfig): TelegramMessage {
  return {
    text: '🔔 <b>Notifications</b>\n\nTap to turn an alert on or off.',
    keyboard: ALERTS.map(a => [{ text: `${config[a.key] ? '✅' : '⬜️'} ${a.label}`, callback_data: `nt:${a.column}` }]),
  };
}

async function weekView(db: D1Database, ctx: FormatContext): Promise<TelegramMessage> {
  const today = cafeDate(new Date(), ctx.timeZone);
  const from = addDays(today, -6);
  const orders = (await ordersBetween(db, from, today, ctx.timeZone)).filter(o => o.status === 'completed');
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(day => {
    const dayOrders = orders.filter(o => cafeDate(new Date(o.createdAt), ctx.timeZone) === day);
    return { day, count: dayOrders.length, revenue: dayOrders.reduce((t, o) => t + Number(o.total_amount || 0), 0) };
  });
  const best = Math.max(...days.map(d => d.revenue), 1);
  const total = days.reduce((t, d) => t + d.revenue, 0);
  const lines = days.map(d => {
    const label = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
    const bar = '█'.repeat(Math.round((d.revenue / best) * 10)) || '·';
    return `<code>${label.padEnd(7)} ${bar.padEnd(10)}</code> ${money(ctx, d.revenue)} (${d.count})`;
  });
  return { text: `📅 <b>Last 7 days</b>\n\n${lines.join('\n')}\n\n<b>Total:</b> ${money(ctx, total)} · <b>Daily average:</b> ${money(ctx, total / 7)}` };
}

async function staffView(db: D1Database, ctx: FormatContext): Promise<TelegramMessage> {
  const { results } = await db.prepare('SELECT s.name, s.role, sh.clock_in FROM shifts sh JOIN staff s ON s.id = sh.staff_id WHERE sh.clock_out IS NULL ORDER BY sh.clock_in').all<Row>();
  if (!results.length) return { text: '🕒 <b>Nobody is clocked in.</b>' };
  const lines = results.map(r => {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(r.clock_in)) / 60000));
    return `👤 <b>${escapeHtml(r.name)}</b> (${escapeHtml(r.role)}) — since ${cafeTime(ctx, r.clock_in)}, ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  });
  return { text: `🕒 <b>On shift (${results.length})</b>\n\n${lines.join('\n')}` };
}

async function statusView(db: D1Database, ctx: FormatContext): Promise<TelegramMessage> {
  const row = await db.prepare('SELECT open_hours FROM settings WHERE id = ?').bind('cafe_config').first<Row>();
  const status = getOpeningStatus(String(row?.open_hours || ''), new Date(), ctx.timeZone);
  return { text: `${status.isOpen ? '🟢' : '🔴'} <b>${escapeHtml(ctx.cafeName)} is ${status.label.toLowerCase()}</b>\n${escapeHtml(status.detail)}\n\n<i>Café time: ${cafeTime(ctx)}</i>` };
}

function helpView(ctx: FormatContext): TelegramMessage {
  return { text: `🤖 <b>${escapeHtml(ctx.cafeName)} bot</b>\n\n${COMMANDS.map(c => `/${c.command} — ${escapeHtml(c.description)}`).join('\n')}` };
}

// --- Actions ---

const findByName = async (db: D1Database, table: 'menu_items' | 'stock_items', query: string, limit: number) => {
  const exact = await db.prepare(`SELECT * FROM ${table} WHERE LOWER(name) = LOWER(?)`).bind(query).all<Row>();
  if (exact.results.length) return exact.results;
  const like = `%${query.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  return (await db.prepare(`SELECT * FROM ${table} WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT ?`).bind(like, limit).all<Row>()).results;
};

async function restock(db: D1Database, stockId: string, quantity: number): Promise<string> {
  const item = await db.prepare('SELECT * FROM stock_items WHERE id = ?').bind(stockId).first<Row>();
  if (!item) return '⚠️ That ingredient no longer exists.';
  await db.prepare("INSERT INTO inventory_movements (id, stock_item_id, kind, quantity, notes, created_at) VALUES (?, ?, 'purchase', ?, 'Restocked from Telegram', ?)")
    .bind(crypto.randomUUID(), stockId, quantity, new Date().toISOString()).run();
  const total = Number(item.quantity) + quantity;
  return `📦 <b>${escapeHtml(item.name)}</b> +${quantity} ${escapeHtml(item.unit)} → <b>${total.toFixed(2)} ${escapeHtml(item.unit)}</b>${total <= Number(item.min_threshold) ? '\n⚠️ Still at or below the reorder level.' : ''}`;
}

async function handleCommand(env: Bindings, config: TelegramConfig, command: string, args: string, reply: (m: TelegramMessage) => Promise<unknown>) {
  const db = env.DB;
  switch (command) {
    case 'start':
    case 'help':
      return reply(helpView(config));
    case 'chatid':
      return reply({ text: `This chat’s ID is <code>${escapeHtml(config.chatId)}</code>.` });
    case 'today': {
      const stats = await dailyStats(db, cafeDate(new Date(), config.timeZone), config.timeZone);
      const open = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending','preparing','ready')").first<Row>();
      const text = formatDailyFinancialReportMessage(stats, config, `TODAY SO FAR · ${cafeTime(config)}`);
      return reply({ text: Number(open?.n) ? text.replace('\n\n💳', `\n<b>⏳ Open Orders:</b> ${open!.n} (see /orders)\n\n💳`) : text });
    }
    case 'report': {
      const date = args.trim() || addDays(cafeDate(new Date(), config.timeZone), -1);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return reply({ text: 'Use a date like <code>/report 2026-10-01</code>, or /report for yesterday.' });
      return reply({ text: formatDailyFinancialReportMessage(await dailyStats(db, date, config.timeZone), config) });
    }
    case 'week':
      return reply(await weekView(db, config));
    case 'orders':
      return reply(await openOrdersView(db, config));
    case 'stock':
      if (args.trim().toLowerCase() === 'all') {
        const { results } = await db.prepare('SELECT * FROM stock_items ORDER BY category, name LIMIT 60').all<Row>();
        const lines = results.map(i => `${Number(i.quantity) <= Number(i.min_threshold) ? '🟠' : '🟢'} ${escapeHtml(i.name)} — ${Number(i.quantity).toFixed(2)} ${escapeHtml(i.unit)}`);
        return reply({ text: `📦 <b>All ingredients</b>\n\n${lines.join('\n') || 'No ingredients yet.'}` });
      }
      return reply(lowStockView(await lowStockItems(db), '📦 <b>Low stock</b>'));
    case 'restock': {
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      const index = tokens.findIndex(t => /^\d+(\.\d+)?$/.test(t));
      const quantity = index >= 0 ? Number(tokens[index]) : NaN;
      const name = tokens.filter((_, i) => i !== index).join(' ');
      if (!name || !(quantity > 0) || quantity > 1e6) return reply({ text: 'Use <code>/restock name quantity</code>, for example <code>/restock oat milk 12</code>. The quantity is in the ingredient’s own unit.' });
      const matches = await findByName(db, 'stock_items', name, 8);
      if (!matches.length) return reply({ text: `No ingredient matches “${escapeHtml(name)}”. Try /stock all.` });
      if (matches.length === 1) return reply({ text: await restock(db, matches[0].id, quantity) });
      return reply({
        text: `Which ingredient gets +${quantity}?`,
        keyboard: matches.filter(m => `rs:${m.id}:${quantity}`.length <= 64).map(m => [{ text: `${m.name} (${m.unit})`, callback_data: `rs:${m.id}:${quantity}` }]),
      });
    }
    case 'menu': {
      const query = args.trim();
      if (!query) return reply(await soldOutView(db, config));
      const matches = await findByName(db, 'menu_items', query, 10);
      if (!matches.length) return reply({ text: `No menu item matches “${escapeHtml(query)}”.` });
      return reply(menuItemsView(matches, `🍽 <b>Menu matches for “${escapeHtml(query)}”</b>`, config));
    }
    case 'soldout':
    case '86':
      return reply(await soldOutView(db, config));
    case 'staff':
      return reply(await staffView(db, config));
    case 'tasks':
      return reply(await tasksView(db));
    case 'expense': {
      const match = args.trim().match(/^(\d+(?:\.\d{1,2})?)\s+([\s\S]+)$/);
      const amount = match ? Number(match[1]) : NaN;
      if (!match || !(amount > 0) || amount > 1e7) return reply({ text: 'Use <code>/expense amount description</code>, for example <code>/expense 250 milk from the corner shop</code>. It is logged as a cash expense for today.' });
      const description = match[2].trim().slice(0, 200);
      const now = new Date();
      await db.prepare('INSERT INTO expenses (id, category, description, amount, date, payment_method, logged_by_staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(`exp-${crypto.randomUUID()}`, 'Marketing & Other', description, amount, cafeDate(now, config.timeZone), 'cash', null, now.toISOString()).run();
      return reply({ text: `💸 Logged <b>${money(config, amount)}</b> cash expense: ${escapeHtml(description)}\n<i>Recategorise it in Finance if needed.</i>` });
    }
    case 'status':
      return reply(await statusView(db, config));
    case 'alerts':
      return reply(alertsView(config));
    default:
      return reply({ text: 'I don’t know that command. Send /help for the list.' });
  }
}

async function handleCallback(env: Bindings, config: TelegramConfig, query: Row) {
  const db = env.DB;
  const message = query.message;
  const [kind, id, value] = String(query.data || '').split(':');
  let toast = '';
  let view: TelegramMessage | null = null;

  if (kind === 'os' || kind === 'ol') {
    const before = await db.prepare('SELECT order_number, status FROM orders WHERE id = ?').bind(id).first<Row>();
    if (!before) toast = 'That order no longer exists.';
    else if (before.status === value) {
      // A stale button: the D1 trigger only checks real changes, so report it here.
      toast = `${before.order_number} is already ${ORDER_STATUS_LABEL[value] || value}.`;
      view = kind === 'os' ? await orderView(db, id, config) : await openOrdersView(db, config);
    } else {
      try {
        await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(value, id).run();
        toast = `${before.order_number} → ${ORDER_STATUS_LABEL[value] || value}`;
      } catch (e) {
        if (!String(e).includes('Invalid order status transition')) throw e;
        toast = `${before.order_number} is already ${ORDER_STATUS_LABEL[before.status] || before.status}.`;
      }
      view = kind === 'os' ? await orderView(db, id, config) : await openOrdersView(db, config);
    }
  } else if (kind === 'ts') {
    const result = await db.prepare("UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ? AND status != 'completed'").bind(new Date().toISOString(), id).run();
    toast = result.meta.changes ? 'Task completed.' : 'That task was already done.';
    view = await tasksView(db);
  } else if (kind === 'mi') {
    await db.prepare('UPDATE menu_items SET is_in_stock = ? WHERE id = ?').bind(value === '1' ? 1 : 0, id).run();
    toast = value === '1' ? 'Back on the menu.' : 'Marked sold out.';
    // Redraw the same items the message was showing.
    const ids = (message?.reply_markup?.inline_keyboard || []).flat().map((b: Row) => String(b.callback_data || '').split(':')).filter((p: string[]) => p[0] === 'mi').map((p: string[]) => p[1]);
    const rows = ids.length ? (await db.prepare(`SELECT * FROM menu_items WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY name`).bind(...ids).all<Row>()).results : [];
    view = menuItemsView(rows, '🍽 <b>Menu availability</b>', config);
  } else if (kind === 'rs') {
    const quantity = Number(value);
    view = { text: quantity > 0 ? await restock(db, id, quantity) : 'Invalid quantity.' };
  } else if (kind === 'nt') {
    const alert = ALERTS.find(a => a.column === id);
    if (alert) {
      await db.prepare(`UPDATE settings SET ${alert.column} = CASE WHEN ${alert.column} = 0 THEN 1 ELSE 0 END WHERE id = ?`).bind('cafe_config').run();
      const updated = await getTelegramConfig(env);
      toast = `${alert.label} ${updated[alert.key] ? 'on' : 'off'}.`;
      view = alertsView(updated);
    }
  }

  await callTelegram(config.botToken, 'answerCallbackQuery', { callback_query_id: query.id, ...(toast ? { text: toast } : {}) });
  if (view && message) {
    await callTelegram(config.botToken, 'editMessageText', {
      chat_id: message.chat.id, message_id: message.message_id, text: view.text, parse_mode: 'HTML', disable_web_page_preview: true,
      reply_markup: { inline_keyboard: view.keyboard || [] },
    });
  }
}

export async function handleTelegramUpdate(env: Bindings, config: TelegramConfig, update: Row) {
  const chatOf = (u: Row) => String((u.callback_query?.message?.chat ?? u.message?.chat)?.id ?? '');
  const chatId = chatOf(update);
  const authorized = !!chatId && chatId === String(config.chatId);

  if (update.callback_query) {
    if (!authorized) return callTelegram(config.botToken, 'answerCallbackQuery', { callback_query_id: update.callback_query.id, text: 'This chat is not linked to the café.' });
    return handleCallback(env, config, update.callback_query);
  }

  const text: string = update.message?.text || '';
  const match = text.match(/^\/([a-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (!match) return;
  const command = match[1].toLowerCase();
  const reply = (m: TelegramMessage) => sendTelegramMessage(config.botToken, chatId, m.text, m.keyboard);

  if (!authorized) {
    // Answer only what someone needs to link the chat; nothing about the café leaks.
    if (['start', 'help', 'chatid'].includes(command)) {
      return reply({ text: `This chat isn’t linked to a café yet.\n\nChat ID: <code>${escapeHtml(chatId)}</code>\nPaste it into Settings → Telegram in the admin workspace, save, then send /help.` });
    }
    return;
  }
  return handleCommand(env, config, command, match[2] || '', reply);
}

export function registerTelegramBot(app: Hono<Env>) {
  // Telegram posts here. It sits outside /api so it skips the browser session check;
  // the secret header, derived from SESSION_SECRET and the bot token, authenticates it instead.
  app.post('/telegram/webhook', async c => {
    const config = await getTelegramConfig(c.env);
    if (!config.botToken || !c.env.SESSION_SECRET || !c.env.DB) return c.json({ ok: false }, 404);
    const secret = await webhookSecret(c.env.SESSION_SECRET, config.botToken);
    if (!sameText(c.req.header('X-Telegram-Bot-Api-Secret-Token') || '', secret)) return c.json({ ok: false }, 403);
    const update = await c.req.json().catch(() => null);
    if (update) {
      try {
        await ensureFeatureTables(c.env.DB);
        await handleTelegramUpdate(c.env, config, update);
      } catch (e) {
        // Always acknowledge so Telegram does not retry the same failing update forever.
        console.error('[Telegram webhook]', e);
      }
    }
    return c.json({ ok: true });
  });

  app.get('/api/telegram/webhook', async c => {
    const config = await getTelegramConfig(c.env);
    if (!config.botToken) return c.json({ success: false, error: 'Save a bot token first.' });
    const info = await callTelegram(config.botToken, 'getWebhookInfo', {});
    if (!info.success) return c.json(info);
    const expected = `${new URL(c.req.url).origin}/telegram/webhook`;
    return c.json({ success: true, data: { url: info.result.url || '', connected: info.result.url === expected, pendingUpdates: info.result.pending_update_count || 0, lastError: info.result.last_error_message || '' } });
  });

  app.post('/api/telegram/webhook', async c => {
    const config = await getTelegramConfig(c.env);
    if (!config.botToken) return c.json({ success: false, error: 'Save a bot token first.' });
    if (!c.env.SESSION_SECRET) return c.json({ success: false, error: 'Set SESSION_SECRET on the server first.' });
    const url = `${new URL(c.req.url).origin}/telegram/webhook`;
    const set = await callTelegram(config.botToken, 'setWebhook', {
      url, secret_token: await webhookSecret(c.env.SESSION_SECRET, config.botToken), allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
    });
    if (!set.success) return c.json({ success: false, error: `Telegram rejected ${url}: ${set.error}` });
    await callTelegram(config.botToken, 'setMyCommands', { commands: COMMANDS });
    return c.json({ success: true, data: { url } });
  });

  app.delete('/api/telegram/webhook', async c => {
    const config = await getTelegramConfig(c.env);
    if (!config.botToken) return c.json({ success: false, error: 'Save a bot token first.' });
    return c.json(await callTelegram(config.botToken, 'deleteWebhook', {}));
  });
}
