export type TelegramNotificationType = 'sales' | 'shifts' | 'tasks' | 'dailyReport' | 'lowStock';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  notifySales: boolean;
  notifyShifts: boolean;
  notifyTasks: boolean;
  notifyDailyReport: boolean;
  notifyLowStock: boolean;
  cafeName: string;
  currency: string;
  timeZone: string;
}

/** Café details every formatter needs so times and money read as they do in the café. */
export interface FormatContext {
  cafeName: string;
  currency: string;
  timeZone: string;
}

export interface InlineButton { text: string; callback_data: string }
export type InlineKeyboard = InlineButton[][];
export interface TelegramMessage { text: string; keyboard?: InlineKeyboard }

/**
 * Fetch Telegram configuration from Cloudflare D1 settings table or env bindings.
 */
export async function getTelegramConfig(env: any): Promise<TelegramConfig> {
  let config: TelegramConfig = {
    botToken: env?.TELEGRAM_BOT_TOKEN || '',
    chatId: env?.TELEGRAM_CHAT_ID || '',
    notifySales: true,
    notifyShifts: true,
    notifyTasks: true,
    notifyDailyReport: true,
    notifyLowStock: true,
    cafeName: 'CHTH',
    currency: '₹',
    timeZone: 'Asia/Tehran',
  };

  if (env?.DB) {
    try {
      const row = await env.DB.prepare('SELECT * FROM settings WHERE id = ?').bind('cafe_config').first();
      if (row) {
        config = {
          botToken: (row.telegram_bot_token as string) || config.botToken,
          chatId: (row.telegram_chat_id as string) || config.chatId,
          notifySales: row.notify_sales !== 0 && row.notify_sales !== false,
          notifyShifts: row.notify_shifts !== 0 && row.notify_shifts !== false,
          notifyTasks: row.notify_tasks !== 0 && row.notify_tasks !== false,
          notifyDailyReport: row.notify_daily_report !== 0 && row.notify_daily_report !== false,
          notifyLowStock: row.notify_low_stock !== 0 && row.notify_low_stock !== false,
          cafeName: (row.cafe_name as string) || config.cafeName,
          currency: (row.currency as string) || config.currency,
          timeZone: (row.time_zone as string) || config.timeZone,
        };
      }
    } catch (e) {
      console.warn('[Telegram] Failed to query DB settings:', e);
    }
  }

  return config;
}

/** Call any Bot API method and normalise the result. */
export async function callTelegram<T = any>(botToken: string, method: string, payload: object): Promise<{ success: boolean; result?: T; error?: string }> {
  if (!botToken) return { success: false, error: 'Telegram Bot Token is missing' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as any;
    if (data.ok) return { success: true, result: data.result };
    console.warn(`[Telegram API Error] ${method}:`, data);
    return { success: false, error: data.description || 'Telegram API returned error' };
  } catch (err: any) {
    console.error('[Telegram Exception]:', err);
    return { success: false, error: err.message || 'Failed to reach Telegram API' };
  }
}

/**
 * Direct HTTP call to Telegram Bot API sendMessage
 */
export async function sendTelegramMessage(botToken: string, chatId: string, messageHtml: string, keyboard?: InlineKeyboard): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram Bot Token or Chat ID is missing' };
  }
  const { success, error } = await callTelegram(botToken, 'sendMessage', {
    chat_id: chatId,
    text: messageHtml,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  return error ? { success, error } : { success };
}

const notificationEnabled = (config: TelegramConfig, type: TelegramNotificationType) => ({
  sales: config.notifySales,
  shifts: config.notifyShifts,
  tasks: config.notifyTasks,
  dailyReport: config.notifyDailyReport,
  lowStock: config.notifyLowStock,
})[type];

/**
 * Dispatch notification if enabled in config. Pass a function to format the message
 * with the café's saved currency, timezone and name.
 */
export async function sendTelegramNotification(
  env: any,
  message: string | TelegramMessage | ((ctx: FormatContext) => string | TelegramMessage),
  type: TelegramNotificationType,
  overrideConfig?: { botToken?: string; chatId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getTelegramConfig(env);
    const token = overrideConfig?.botToken || config.botToken;
    const chatId = overrideConfig?.chatId || config.chatId;

    if (!token || !chatId) {
      return { success: false, error: 'Telegram bot not configured (missing token or chat ID)' };
    }
    if (!notificationEnabled(config, type)) return { success: true };

    const built = typeof message === 'function' ? message(config) : message;
    const { text, keyboard } = typeof built === 'string' ? { text: built, keyboard: undefined } : built;
    return await sendTelegramMessage(token, chatId, text, keyboard);
  } catch (err: any) {
    console.warn('[Telegram Dispatch Warning]:', err);
    return { success: false, error: err.message };
  }
}

// --- Shared formatting helpers ---

export const money = (ctx: FormatContext, amount: number) => `${ctx.currency}${Number(amount || 0).toFixed(2)}`;

export const cafeTime = (ctx: FormatContext, date: Date | string = new Date()) => {
  try {
    return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: ctx.timeZone });
  } catch {
    return new Date(date).toISOString().slice(11, 16);
  }
};

export const cafeDay = (ctx: FormatContext, date: Date | string = new Date()) => {
  try {
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: ctx.timeZone });
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
};

const footer = (ctx: FormatContext, label: string) => `<i>${escapeHtml(ctx.cafeName)} · ${label}</i>`;

export const ORDER_NEXT_STATUS: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'completed' };
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
};
const ADVANCE_LABEL: Record<string, string> = { preparing: '👨‍🍳 Start preparing', ready: '🔔 Mark ready', completed: '✅ Complete' };

/** Buttons that move an order to its next status, or cancel it while that is still allowed. */
export function orderKeyboard(order: { id: string; status: string }): InlineKeyboard {
  const next = ORDER_NEXT_STATUS[order.status];
  if (!next || `os:${order.id}:${next}`.length > 64) return [];
  return [[
    { text: ADVANCE_LABEL[next], callback_data: `os:${order.id}:${next}` },
    { text: '✖ Cancel', callback_data: `os:${order.id}:cancelled` },
  ]];
}

// --- Message Formatters ---

export function formatStockAlertMessage(item: any, ctx: FormatContext): string {
  const name = item.name || 'Raw Material';
  const qty = Number(item.quantity || 0).toFixed(2);
  const unit = item.unit || 'units';
  const min = Number(item.minThreshold || 0).toFixed(2);
  const category = item.category || 'Inventory';
  const statusEmoji = Number(item.quantity || 0) <= 0 ? '🔴 OUT OF STOCK' : '⚠️ LOW STOCK ALERT';

  return `${statusEmoji}

<b>Item Name:</b> ${escapeHtml(name)}
<b>Category:</b> ${escapeHtml(category)}
<b>Current Stock:</b> <b>${qty} ${escapeHtml(unit)}</b>
<b>Min Threshold:</b> ${min} ${escapeHtml(unit)}
<b>Unit Cost:</b> ${money(ctx, item.unitCost)}
<b>Alert Time:</b> ${cafeTime(ctx)}

${footer(ctx, 'Restock with /restock')}`;
}

export function formatSaleMessage(order: any, items: any[] = [], ctx: FormatContext): TelegramMessage {
  const orderNum = order.orderNumber || order.id || '#ORDER';
  const customer = order.customerName || 'Walk-in Customer';
  const orderType = (order.orderType || 'dine_in').replace('_', ' ').toUpperCase();
  const paymentMethod = (order.paymentMethod || 'card').replace('_', ' ').toUpperCase();

  let itemsList = '';
  if (items && items.length > 0) {
    itemsList = '\n<b>🛒 Items:</b>\n' + items.map(i => {
      const q = i.quantity || 1;
      const name = i.itemName || i.name || 'Item';
      const itemTot = Number(i.itemTotal || (i.unitPrice * q) || 0);
      return ` • ${q}x <b>${escapeHtml(name)}</b> — ${money(ctx, itemTot)}`;
    }).join('\n');
  }

  const text = `🎉 <b>NEW SALE ALERT!</b>

<b>Order:</b> ${escapeHtml(orderNum)}
<b>Customer:</b> ${escapeHtml(customer)}
<b>Type:</b> ${orderType}
<b>Total Amount:</b> <b>${money(ctx, order.totalAmount)}</b> (${paymentMethod})
<b>Status:</b> ${ORDER_STATUS_LABEL[order.status] || 'Pending'}
<b>Time:</b> ${cafeTime(ctx, order.createdAt || Date.now())}${itemsList}

${footer(ctx, 'POS')}`;
  return { text, keyboard: order.id ? orderKeyboard({ id: order.id, status: order.status || 'pending' }) : [] };
}

export function formatShiftMessage(action: 'in' | 'out', staffName: string, shift: any, ctx: FormatContext): string {
  const time = cafeTime(ctx);
  const date = cafeDay(ctx);

  if (action === 'in') {
    return `⏰ <b>EMPLOYEE CLOCK-IN</b>

👤 <b>Staff:</b> ${escapeHtml(staffName)}
📅 <b>Date:</b> ${date}
🕒 <b>Clock In Time:</b> ${time}
${shift.notes ? `📝 <b>Notes:</b> ${escapeHtml(shift.notes)}` : ''}

${footer(ctx, 'Shift Tracker')}`;
  } else {
    const hours = Number(shift.totalHours || 0).toFixed(2);
    return `🚪 <b>EMPLOYEE CLOCK-OUT</b>

👤 <b>Staff:</b> ${escapeHtml(staffName)}
📅 <b>Date:</b> ${date}
🕒 <b>Clock Out Time:</b> ${time}
⏱ <b>Total Shift Duration:</b> ${hours} hrs
💰 <b>Earned Pay:</b> ${money(ctx, shift.totalPay)}
${shift.notes ? `📝 <b>Notes:</b> ${escapeHtml(shift.notes)}` : ''}

${footer(ctx, 'Shift Tracker')}`;
  }
}

export function formatTaskMessage(task: any, staffName: string | undefined, ctx: FormatContext): string {
  const category = task.category || 'General';
  const priority = (task.priority || 'medium').toUpperCase();

  return `✅ <b>TASK COMPLETED!</b>

📋 <b>Task:</b> ${escapeHtml(task.title)}
🏷 <b>Category:</b> ${escapeHtml(category)}
🔥 <b>Priority:</b> ${priority}
${staffName ? `👤 <b>Completed By:</b> ${escapeHtml(staffName)}` : ''}
🕒 <b>Completed At:</b> ${cafeTime(ctx)}
${task.description ? `📝 <b>Details:</b> ${escapeHtml(task.description)}` : ''}

${footer(ctx, 'Task Manager')}`;
}

export interface DailyStats {
  dateStr: string;
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  totalExpenses: number;
  netProfit: number;
  cashTotal: number;
  cardTotal: number;
  qrTotal: number;
  otherTotal: number;
  topItems: { name: string; quantity: number; revenue: number }[];
}

export function formatDailyFinancialReportMessage(stats: DailyStats, ctx: FormatContext, title = 'DAILY FINANCIAL RECORD'): string {
  const netSign = stats.netProfit >= 0 ? '+' : '-';
  const netEmoji = stats.netProfit >= 0 ? '📈' : '📉';
  const average = stats.totalOrders ? stats.totalRevenue / stats.totalOrders : 0;
  const top = stats.topItems.length
    ? '\n\n🏆 <b>Top Sellers:</b>\n' + stats.topItems.map((item, i) => ` ${i + 1}. ${escapeHtml(item.name)} × ${item.quantity} — ${money(ctx, item.revenue)}`).join('\n')
    : '';

  return `📊 <b>${title}</b>
📅 <b>Date:</b> ${stats.dateStr}

<b>💵 Total Revenue:</b> ${money(ctx, stats.totalRevenue)}
<b>🛒 Completed Orders:</b> ${stats.totalOrders}${stats.cancelledOrders ? ` (${stats.cancelledOrders} cancelled)` : ''}
<b>🧾 Average Ticket:</b> ${money(ctx, average)}
<b>💸 Total Expenses:</b> ${money(ctx, stats.totalExpenses)}
<b>${netEmoji} Net Profit:</b> <b>${netSign}${money(ctx, Math.abs(stats.netProfit))}</b>

💳 <b>Payment Breakdown:</b>
 • Cash: ${money(ctx, stats.cashTotal)}
 • Card: ${money(ctx, stats.cardTotal)}
 • QR Pay: ${money(ctx, stats.qrTotal)}${stats.otherTotal ? `\n • Other: ${money(ctx, stats.otherTotal)}` : ''}${top}

${footer(ctx, 'Cafe Manager')}`;
}

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
