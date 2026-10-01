export type TelegramNotificationType = 'sales' | 'shifts' | 'tasks' | 'dailyReport' | 'lowStock';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  notifySales: boolean;
  notifyShifts: boolean;
  notifyTasks: boolean;
  notifyDailyReport: boolean;
  notifyLowStock: boolean;
}

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
        };
      }
    } catch (e) {
      console.warn('[Telegram] Failed to query DB settings:', e);
    }
  }

  return config;
}

/**
 * Direct HTTP call to Telegram Bot API sendMessage
 */
export async function sendTelegramMessage(botToken: string, chatId: string, messageHtml: string): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram Bot Token or Chat ID is missing' };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json() as any;
    if (data.ok) {
      return { success: true };
    } else {
      console.warn('[Telegram API Error]:', data);
      return { success: false, error: data.description || 'Telegram API returned error' };
    }
  } catch (err: any) {
    console.error('[Telegram Exception]:', err);
    return { success: false, error: err.message || 'Failed to reach Telegram API' };
  }
}

/**
 * Dispatch notification if enabled in config
 */
export async function sendTelegramNotification(
  env: any,
  messageHtml: string,
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

    // Check type toggles
    if (type === 'sales' && !config.notifySales) return { success: true };
    if (type === 'shifts' && !config.notifyShifts) return { success: true };
    if (type === 'tasks' && !config.notifyTasks) return { success: true };
    if (type === 'dailyReport' && !config.notifyDailyReport) return { success: true };
    if (type === 'lowStock' && !config.notifyLowStock) return { success: true };

    return await sendTelegramMessage(token, chatId, messageHtml);
  } catch (err: any) {
    console.warn('[Telegram Dispatch Warning]:', err);
    return { success: false, error: err.message };
  }
}

// --- Message Formatters ---

export function formatStockAlertMessage(item: any, currency: string = '₹'): string {
  const name = item.name || 'Raw Material';
  const qty = Number(item.quantity || 0).toFixed(2);
  const unit = item.unit || 'units';
  const min = Number(item.minThreshold || 0).toFixed(2);
  const category = item.category || 'Inventory';
  const cost = Number(item.unitCost || 0).toFixed(2);
  const statusEmoji = Number(item.quantity || 0) <= 0 ? '🔴 OUT OF STOCK' : '⚠️ LOW STOCK ALERT';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return `${statusEmoji}

<b>Item Name:</b> ${escapeHtml(name)}
<b>Category:</b> ${escapeHtml(category)}
<b>Current Stock:</b> <b>${qty} ${unit}</b>
<b>Min Threshold:</b> ${min} ${unit}
<b>Unit Cost:</b> ${currency}${cost}
<b>Alert Time:</b> ${time}

<i>Immediate replenishment recommended. CHTH Stock Manager</i>`;
}

export function formatSaleMessage(order: any, items: any[] = [], currency: string = '₹'): string {
  const orderNum = order.orderNumber || order.id || '#ORDER';
  const customer = order.customerName || 'Walk-in Customer';
  const orderType = (order.orderType || 'dine_in').replace('_', ' ').toUpperCase();
  const paymentMethod = (order.paymentMethod || 'card').toUpperCase();
  const total = Number(order.totalAmount || 0).toFixed(2);
  const time = new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let itemsList = '';
  if (items && items.length > 0) {
    itemsList = '\n<b>🛒 Items:</b>\n' + items.map(i => {
      const q = i.quantity || 1;
      const name = i.itemName || i.name || 'Item';
      const itemTot = Number(i.itemTotal || (i.unitPrice * q) || 0).toFixed(2);
      return ` • ${q}x <b>${escapeHtml(name)}</b> — ${currency}${itemTot}`;
    }).join('\n');
  }

  return `🎉 <b>NEW SALE ALERT!</b>

<b>Order:</b> ${escapeHtml(orderNum)}
<b>Customer:</b> ${escapeHtml(customer)}
<b>Type:</b> ${orderType}
<b>Total Amount:</b> <b>${currency}${total}</b> (${paymentMethod})
<b>Time:</b> ${time}${itemsList}

<i>CHTH POS Notification</i>`;
}

export function formatShiftMessage(action: 'in' | 'out', staffName: string, shift: any, currency: string = '₹'): string {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  if (action === 'in') {
    return `⏰ <b>EMPLOYEE CLOCK-IN</b>

👤 <b>Staff:</b> ${escapeHtml(staffName)}
📅 <b>Date:</b> ${date}
🕒 <b>Clock In Time:</b> ${time}
${shift.notes ? `📝 <b>Notes:</b> ${escapeHtml(shift.notes)}` : ''}

<i>CHTH Shift Tracker</i>`;
  } else {
    const hours = Number(shift.totalHours || 0).toFixed(2);
    const pay = Number(shift.totalPay || 0).toFixed(2);
    return `🚪 <b>EMPLOYEE CLOCK-OUT</b>

👤 <b>Staff:</b> ${escapeHtml(staffName)}
📅 <b>Date:</b> ${date}
🕒 <b>Clock Out Time:</b> ${time}
⏱ <b>Total Shift Duration:</b> ${hours} hrs
💰 <b>Earned Pay:</b> ${currency}${pay}
${shift.notes ? `📝 <b>Notes:</b> ${escapeHtml(shift.notes)}` : ''}

<i>CHTH Shift Tracker</i>`;
  }
}

export function formatTaskMessage(task: any, staffName?: string): string {
  const category = task.category || 'General';
  const priority = (task.priority || 'medium').toUpperCase();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return `✅ <b>TASK COMPLETED!</b>

📋 <b>Task:</b> ${escapeHtml(task.title)}
🏷 <b>Category:</b> ${escapeHtml(category)}
🔥 <b>Priority:</b> ${priority}
${staffName ? `👤 <b>Completed By:</b> ${escapeHtml(staffName)}` : ''}
🕒 <b>Completed At:</b> ${time}
${task.description ? `📝 <b>Details:</b> ${escapeHtml(task.description)}` : ''}

<i>CHTH Task Manager</i>`;
}

export function formatDailyFinancialReportMessage(stats: {
  dateStr: string;
  totalRevenue: number;
  totalOrders: number;
  totalExpenses: number;
  netProfit: number;
  cashTotal: number;
  cardTotal: number;
  qrTotal: number;
  currency: string;
}): string {
  const currency = stats.currency || '₹';
  const netSign = stats.netProfit >= 0 ? '+' : '';
  const netEmoji = stats.netProfit >= 0 ? '📈' : '📉';

  return `📊 <b>DAILY FINANCIAL RECORD (12:00 AM)</b>
📅 <b>Date:</b> ${stats.dateStr}

<b>💵 Total Revenue:</b> ${currency}${stats.totalRevenue.toFixed(2)}
<b>🛒 Total Orders:</b> ${stats.totalOrders}
<b>💸 Total Expenses:</b> ${currency}${stats.totalExpenses.toFixed(2)}
<b>${netEmoji} Net Profit:</b> <b>${netSign}${currency}${stats.netProfit.toFixed(2)}</b>

💳 <b>Payment Breakdown:</b>
 • Cash: ${currency}${stats.cashTotal.toFixed(2)}
 • Card: ${currency}${stats.cardTotal.toFixed(2)}
 • QR Pay: ${currency}${stats.qrTotal.toFixed(2)}

<i>Automated Midnight Summary — CHTH Cafe Manager</i>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
