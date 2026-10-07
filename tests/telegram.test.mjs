import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

// The Bot API is mocked: every outbound call is recorded and answered with { ok: true }.
const calls = [];
const outboundService = async request => {
  const url = new URL(request.url);
  if (url.hostname !== 'api.telegram.org') return new Response('blocked', { status: 502 });
  const method = url.pathname.split('/').pop();
  const body = await request.json();
  calls.push({ method, body });
  const result = method === 'getWebhookInfo' ? { url: 'http://localhost/telegram/webhook', pending_update_count: 0 } : true;
  return Response.json({ ok: true, result });
};

const SECRET = 'test-session-secret-with-at-least-32-characters';
const TOKEN = '123456:test-token';
const bundle = await build({ entryPoints: ['src/server.ts'], bundle: true, format: 'esm', platform: 'browser', write: false });
const mf = new Miniflare(convertV4MiniflareOptions({
  log: new Log(LogLevel.NONE), modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2025-01-01',
  d1Databases: { DB: 'telegram-cafe' }, kvNamespaces: ['KV'], outboundService,
  bindings: { ADMIN_PASSWORD: 'test-admin-password', PANEL_PASSWORD: 'test-panel-password', SESSION_SECRET: SECRET, CAFE_DEV_PROXY: 'true' },
}));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const ok = value => { assert.ok(value); checks++; };

const webhookSecret = createHmac('sha256', SECRET).update(`telegram-webhook:${TOKEN}`).digest('hex');
let updateId = 1;
const send = (update, secret = webhookSecret) => mf.dispatchFetch('http://localhost/telegram/webhook', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
  body: JSON.stringify({ update_id: updateId++, ...update }),
});
const command = (text, chatId = 42) => send({ message: { message_id: updateId, chat: { id: chatId, type: 'private' }, text } });
const press = (data, keyboard = [], chatId = 42) => send({ callback_query: { id: `cb${updateId}`, data, message: { message_id: 7, chat: { id: chatId }, reply_markup: { inline_keyboard: keyboard } } } });
const take = () => calls.splice(0);
const sent = () => take().filter(c => c.method === 'sendMessage');

try {
  const db = await mf.getD1Database('DB');
  const schema = (await readFile('schema.sql', 'utf8')).replace(/^--.*$/gm, '');
  for (const sql of schema.match(/CREATE TRIGGER[\s\S]*?\nEND;|CREATE TABLE[\s\S]*?;|INSERT[\s\S]*?;/g)) await db.prepare(sql).run();
  await db.prepare("UPDATE settings SET telegram_bot_token = ?, telegram_chat_id = '42', currency = '$', time_zone = 'UTC', cafe_name = 'Test Café'").bind(TOKEN).run();

  // Only Telegram, holding the derived secret, may post updates.
  check((await send({ message: { chat: { id: 42 }, text: '/help' } }, 'wrong')).status, 403);
  check((await send({ message: { chat: { id: 42 }, text: '/help' } }, '')).status, 403);
  check(take().length, 0);

  // An unlinked chat learns its own ID and nothing else.
  check((await command('/today', 99)).status, 200);
  check(take().length, 0);
  await command('/chatid', 99);
  let [reply] = sent();
  check(reply.body.chat_id, '99'); ok(reply.body.text.includes('<code>99</code>'));
  await press('mi:item-espresso:0', [], 99);
  check(take().map(c => c.method), ['answerCallbackQuery']);
  check((await db.prepare("SELECT is_in_stock FROM menu_items WHERE id = 'item-espresso'").first()).is_in_stock, 1);

  await command('/help');
  [reply] = sent();
  check(reply.body.chat_id, '42'); ok(reply.body.text.includes('/orders')); ok(reply.body.text.includes('Test Café'));

  // Orders: advance from the notification buttons; the D1 trigger still guards transitions.
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO orders (id, order_number, customer_name, order_type, subtotal, tax_amount, total_amount, payment_method, status, createdAt) VALUES ('ord-tg-1', '#TG1', 'Ada', 'pickup', 100, 0, 100, 'cash', 'pending', ?)").bind(now).run();
  await db.prepare("INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, item_total) VALUES ('ord-tg-1-item-0', 'ord-tg-1', 'item-espresso', 'Espresso', 2, 50, 100)").run();
  await command('/orders');
  [reply] = sent();
  ok(reply.body.text.includes('#TG1'));
  ok(reply.body.reply_markup.inline_keyboard.some(row => row[0].callback_data === 'ol:ord-tg-1:preparing'));
  await press('os:ord-tg-1:preparing');
  let [answer, edit] = take();
  check(answer.body.text, '#TG1 → Preparing');
  check(edit.method, 'editMessageText'); ok(edit.body.text.includes('Preparing'));
  check(edit.body.reply_markup.inline_keyboard[0][0].callback_data, 'os:ord-tg-1:ready');
  await press('os:ord-tg-1:preparing');
  check(take()[0].body.text, '#TG1 is already Preparing.');
  await press('ol:ord-tg-1:ready');
  await press('ol:ord-tg-1:completed');
  check((await db.prepare("SELECT status FROM orders WHERE id = 'ord-tg-1'").first()).status, 'completed');
  ok(!take().at(-1).body.text.includes('#TG1'));

  // Today's summary counts the completed order and its items.
  await command('/today');
  [reply] = sent();
  ok(reply.body.text.includes('$100.00')); ok(reply.body.text.includes('Espresso × 2'));

  // Menu availability toggles and redraws the same items.
  await command('/menu espresso');
  [reply] = sent();
  const menuKeyboard = reply.body.reply_markup.inline_keyboard;
  ok(menuKeyboard.some(row => row[0].callback_data === 'mi:item-espresso:0'));
  await press('mi:item-espresso:0', menuKeyboard);
  check((await db.prepare("SELECT is_in_stock FROM menu_items WHERE id = 'item-espresso'").first()).is_in_stock, 0);
  [answer, edit] = take();
  ok(edit.body.reply_markup.inline_keyboard.some(row => row[0].callback_data === 'mi:item-espresso:1'));
  await command('/soldout');
  ok(sent()[0].body.text.includes('Espresso'));

  // Restocking records a purchase movement that the trigger applies.
  await db.prepare("INSERT INTO stock_items (id, name, category, quantity, unit, unit_cost, total_price, min_threshold, updated_at, created_at) VALUES ('stock-tg-saffron', 'Telegram Saffron', 'Other', 1, 'g', 2, 2, 5, ?, ?)").bind(now, now).run();
  await command('/stock');
  ok(sent()[0].body.text.includes('Telegram Saffron'));
  await command('/restock telegram saffron 4.5');
  ok(sent()[0].body.text.includes('5.50 g'));
  check((await db.prepare("SELECT quantity FROM stock_items WHERE id = 'stock-tg-saffron'").first()).quantity, 5.5);
  check((await db.prepare("SELECT kind, quantity FROM inventory_movements WHERE stock_item_id = 'stock-tg-saffron'").first()), { kind: 'purchase', quantity: 4.5 });
  await command('/restock saffron');
  ok(sent()[0].body.text.includes('Use <code>/restock'));

  // Expenses are logged as cash for the café date.
  await command('/expense 12.5 milk <run>');
  ok(sent()[0].body.text.includes('milk &lt;run&gt;'));
  check(await db.prepare("SELECT amount, payment_method, date FROM expenses WHERE description = 'milk <run>'").first(), { amount: 12.5, payment_method: 'cash', date: now.slice(0, 10) });
  await command('/expense lots');
  ok(sent()[0].body.text.includes('Use <code>/expense'));

  // Tasks complete from their button.
  const task = await db.prepare("SELECT id FROM tasks WHERE status != 'completed' LIMIT 1").first();
  await command('/tasks');
  ok(sent()[0].body.reply_markup.inline_keyboard.some(row => row[0].callback_data === `ts:${task.id}`));
  const versionBefore = (await db.prepare('SELECT version FROM sync_state WHERE id = 1').first())?.version ?? 0;
  await press(`ts:${task.id}`);
  ok((await db.prepare('SELECT version FROM sync_state WHERE id = 1').first()).version > versionBefore);
  check(take()[0].body.text, 'Task completed.');
  check((await db.prepare('SELECT status FROM tasks WHERE id = ?').bind(task.id).first()).status, 'completed');

  // Alert toggles write straight to settings.
  await press('nt:notify_sales');
  check(take()[0].body.text, 'Sales off.');
  check((await db.prepare("SELECT notify_sales FROM settings WHERE id = 'cafe_config'").first()).notify_sales, 0);
  await press('nt:notify_sales; DROP TABLE settings');
  check((await db.prepare("SELECT notify_sales FROM settings WHERE id = 'cafe_config'").first()).notify_sales, 0);
  take();

  for (const text of ['/week', '/staff', '/status', '/report', '/report 2026-02-30x', '/alerts', '/nope']) {
    check((await command(text)).status, 200);
    check(sent().length, 1);
  }

  // Cron: yesterday's report goes out once, however many times the hourly trigger fires.
  const worker = await mf.getWorker();
  await worker.scheduled({ scheduledTime: new Date(), cron: '0 * * * *' });
  await worker.scheduled({ scheduledTime: new Date(), cron: '0 * * * *' });
  check(sent().filter(c => c.body.text.includes('DAILY FINANCIAL RECORD')).length, 1);

  // Admin connects the webhook with the same derived secret and publishes the command list.
  const login = await mf.dispatchFetch('http://localhost/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-admin-password' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  check((await mf.dispatchFetch('http://localhost/api/telegram/webhook', { method: 'POST' })).status, 401);
  const connect = await (await mf.dispatchFetch('http://localhost/api/telegram/webhook', { method: 'POST', headers: { Cookie: cookie } })).json();
  check(connect.success, true);
  const [setWebhook, setMyCommands] = take();
  check(setWebhook.method, 'setWebhook');
  check(setWebhook.body.url, 'http://localhost/telegram/webhook');
  check(setWebhook.body.secret_token, webhookSecret);
  check(setMyCommands.method, 'setMyCommands');
  const info = await (await mf.dispatchFetch('http://localhost/api/telegram/webhook', { headers: { Cookie: cookie } })).json();
  check(info.data.connected, true);

  console.log(`Passed ${checks} Telegram bot assertions.`);
} finally { await mf.dispose(); }
