import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

// Release 1.2 on the Worker and D1: menu order, promotions, option recipes, pickup slots, tips, club stamps and points,
// receipts (with the Telegram deep link), suppliers and purchase orders, and the waste report. The Bot API is mocked.
const calls = [];
const outboundService = async request => {
  const url = new URL(request.url);
  if (url.hostname !== 'api.telegram.org') return new Response('blocked', { status: 502 });
  const method = url.pathname.split('/').pop();
  calls.push({ method, body: await request.json() });
  return Response.json({ ok: true, result: method === 'getMe' ? { username: 'test_cafe_bot' } : true });
};
const SECRET = 'test-session-secret-with-at-least-32-characters';
const TOKEN = '123456:test-token';
const bundle = await build({ entryPoints: ['src/server.ts'], bundle: true, format: 'esm', platform: 'browser', loader: { '.sql': 'text' }, write: false });
const mf = new Miniflare(convertV4MiniflareOptions({
  log: new Log(LogLevel.NONE), modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2025-01-01',
  d1Databases: { DB: 'release-cafe' }, kvNamespaces: ['KV'], outboundService,
  bindings: { ADMIN_PASSWORD: 'test-admin-password', PANEL_PASSWORD: 'test-panel-password', SESSION_SECRET: SECRET, CAFE_DEV_PROXY: 'true' }
}));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const ok = value => { assert.ok(value); checks++; };
const near = (actual, expected) => { assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`); checks++; };
let cookie = '', panelCookie = '';
const request = (path, body, method, host = 'localhost', withCookie = cookie) => mf.dispatchFetch(`http://${host}${path}`, {
  method: method || (body === undefined ? 'GET' : 'POST'),
  headers: { 'Content-Type': 'application/json', Cookie: withCookie },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const admin = (path, body, method) => request(path, body, method);
const panel = (path, body, method) => request(path, body, method, 'panel.localhost', panelCookie);
const visitor = (path, body, method) => request(path, body, method, 'localhost', '');
const json = async response => (await response).json();

try {
  const db = await mf.getD1Database('DB');
  const schema = (await readFile('schema.sql', 'utf8')).replace(/^--.*$/gm, '');
  for (const sql of schema.match(/CREATE TRIGGER[\s\S]*?\nEND;|CREATE TABLE[\s\S]*?;|INSERT[\s\S]*?;/g)) await db.prepare(sql).run();
  // Open all day, so public orders and pickup slots work whenever the test runs.
  const allDay = JSON.stringify(Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { open: '00:00', close: '23:59', closed: false }])));
  await db.prepare("UPDATE settings SET open_hours = ?, time_zone = 'UTC', telegram_bot_token = '', telegram_chat_id = '', notify_sales = 0, notify_low_stock = 0 WHERE id = 'cafe_config'").bind(allDay).run();
  cookie = (await visitor('/api/auth/login', { password: 'test-admin-password' })).headers.get('set-cookie').split(';')[0];
  panelCookie = (await request('/api/auth/login', { password: 'test-panel-password' }, 'POST', 'panel.localhost', '')).headers.get('set-cookie').split(';')[0];
  const stock = async id => Number(Number((await db.prepare('SELECT quantity FROM stock_items WHERE id = ?').bind(id).first()).quantity).toFixed(6));

  // --- Menu order: one request saves the positions; the public menu and the panel read them back in that order.
  let menu = (await json(visitor('/api/menu'))).data;
  const categoryIds = menu.map(c => c.id);
  const iced = menu.find(c => c.id === 'cat-iced');
  const itemIds = iced.items.map(i => i.id).reverse();
  check((await panel('/api/menu/order', { categories: [...categoryIds].reverse() }, 'PUT')).status, 403);
  check((await admin('/api/menu/order', { categories: 'nope' }, 'PUT')).status, 400);
  check((await admin('/api/menu/order', { categories: [...categoryIds].reverse(), items: { 'cat-iced': itemIds } }, 'PUT')).status, 200);
  menu = (await json(visitor('/api/menu'))).data;
  check(menu.map(c => c.id), [...categoryIds].reverse());
  check(menu.find(c => c.id === 'cat-iced').items.map(i => i.id), itemIds);
  check((await json(panel('/api/menu'))).data.find(c => c.id === 'cat-iced').items.map(i => i.id), itemIds);
  // A new item goes to the end of its category.
  check((await admin('/api/menu/items', { item: { id: 'item-new-tonic', categoryId: 'cat-iced', name: 'Espresso Tonic', basePrice: 200, isInStock: true }, variants: [] })).status, 200);
  check((await json(visitor('/api/menu'))).data.find(c => c.id === 'cat-iced').items.at(-1).id, 'item-new-tonic');

  // --- Option recipes: an extra shot adds espresso beans; "no foam" takes away the syrup the recipe uses.
  const options = [
    { id: 'var-mc-oat', groupName: 'Milk Choice', name: 'Oat Milk', priceModifier: 0 },
    { id: 'var-mc-coco', groupName: 'Milk Choice', name: 'Coconut Milk', priceModifier: 0.5 },
    { id: 'var-single', groupName: 'Shots', name: 'Single', priceModifier: 0 },
    { id: 'var-extra-shot', groupName: 'Shots', name: 'Extra shot', priceModifier: 40, stock: [{ stockItemId: 'stock-2', quantity: 0.018 }] },
    { id: 'var-foam', groupName: 'Foam', name: 'Cold foam', priceModifier: 0 },
    { id: 'var-no-foam', groupName: 'Foam', name: 'No foam', priceModifier: 0, stock: [{ stockItemId: 'stock-5', quantity: -0.03 }] }
  ];
  check((await admin('/api/menu/items/item-iced-matcha', { variants: [{ ...options[3], stock: [{ stockItemId: 'missing', quantity: 1 }] }] }, 'PUT')).status, 400);
  check((await admin('/api/menu/items/item-iced-matcha', { variants: [{ ...options[3], stock: [{ stockItemId: 'stock-2', quantity: 0 }] }] }, 'PUT')).status, 400);
  check((await admin('/api/menu/items/item-iced-matcha', { variants: options }, 'PUT')).status, 200);
  const adminMatcha = (await json(admin('/api/admin/menu'))).data.flatMap(c => c.items).find(i => i.id === 'item-iced-matcha');
  check(adminMatcha.variants.find(v => v.id === 'var-extra-shot').stock, [{ stockItemId: 'stock-2', quantity: 0.018 }]);
  check((await json(visitor('/api/menu'))).data.flatMap(c => c.items).find(i => i.id === 'item-iced-matcha').variants.some(v => 'stock' in v), false);
  const beans = await stock('stock-2'), syrup = await stock('stock-5'), matcha = await stock('stock-1');
  const optionLine = quantity => ({ menuItemId: 'item-iced-matcha', itemName: 'Matcha', quantity, unitPrice: 320, variants: ['var-mc-oat', 'var-extra-shot', 'var-no-foam'] });
  let response = await admin('/api/orders', { orderType: 'dine_in', paymentMethod: 'card', items: [optionLine(2)] });
  check(response.status, 200);
  const optionOrder = (await response.json()).data;
  near(await stock('stock-2'), beans - 0.036);
  near(await stock('stock-5'), syrup);
  near(await stock('stock-1'), matcha - 0.03);
  check((await admin(`/api/orders/${optionOrder.id}`, { orderType: 'dine_in', paymentMethod: 'card', discountAmount: 0, items: [optionLine(1)] }, 'PUT')).status, 200);
  near(await stock('stock-2'), beans - 0.018);
  near(await stock('stock-5'), syrup);
  // Dropping "no foam" takes the syrup after all.
  check((await admin(`/api/orders/${optionOrder.id}`, { orderType: 'dine_in', paymentMethod: 'card', discountAmount: 0, items: [{ ...optionLine(1), unitPrice: 320, variants: ['var-mc-oat', 'var-extra-shot', 'var-foam'] }] }, 'PUT')).status, 200);
  near(await stock('stock-5'), syrup - 0.03);
  check((await admin(`/api/orders/${optionOrder.id}`, undefined, 'DELETE')).status, 200);
  near(await stock('stock-2'), beans);
  near(await stock('stock-5'), syrup);

  // --- Promotions: the public menu reads them, public orders get them, and an ended one asks for a review.
  check((await panel('/api/promotions', { name: 'Nope', kind: 'percent', value: 10 })).status, 403);
  check((await admin('/api/promotions', { name: '', kind: 'percent', value: 10 })).status, 400);
  check((await admin('/api/promotions', { name: 'Too much', kind: 'percent', value: 150 })).status, 400);
  check((await admin('/api/promotions', { name: 'Half window', kind: 'percent', value: 10, startTime: '15:00' })).status, 400);
  response = await admin('/api/promotions', { name: 'Matcha hour', kind: 'percent', value: 25, itemIds: ['item-iced-matcha'] });
  check(response.status, 200);
  const promo = (await response.json()).data;
  const today = new Date().getUTCDay();
  await json(admin('/api/promotions', { name: 'Not today', kind: 'fixed', value: 200, itemIds: ['item-iced-matcha'], days: [(today + 1) % 7] }));
  check((await json(visitor('/api/promotions'))).data.map(p => p.name).sort(), ['Matcha hour', 'Not today']);
  check((await json(panel('/api/promotions'))).data.length, 2);
  const publicLine = (discountAmount, promotionId) => ({ menuItemId: 'item-iced-matcha', itemName: 'Matcha', quantity: 2, unitPrice: 280, variants: ['var-mc-oat', 'var-single', 'var-no-foam'], discountAmount, ...(promotionId ? { promotionId } : {}) });
  const publicOrder = (items, extra = {}) => visitor('/api/orders', { id: `public-${crypto.randomUUID()}`, customerName: 'Guest', orderType: 'takeout', paymentMethod: 'cash', items, ...extra });
  response = await publicOrder([publicLine(140, promo.id)]);
  check(response.status, 200);
  const promoOrder = (await response.json()).data;
  check([promoOrder.subtotal, promoOrder.discountAmount, promoOrder.taxAmount, promoOrder.totalAmount], [560, 140, 35.7, 455.7]);
  check((await db.prepare('SELECT discount_amount FROM order_items WHERE order_id = ?').bind(promoOrder.id).first()).discount_amount, 140);
  // A line priced before the promotion started still gets it.
  check((await json(publicOrder([publicLine(0)]))).data.discountAmount, 140);
  check((await publicOrder([publicLine(100, promo.id)])).status, 409);
  check((await admin(`/api/promotions/${promo.id}`, { active: false }, 'PUT')).status, 200);
  check((await publicOrder([publicLine(140, promo.id)])).status, 409);
  check((await json(publicOrder([publicLine(0)]))).data.discountAmount, 0);
  check((await json(visitor('/api/promotions'))).data.map(p => p.name), ['Not today']);
  check((await json(admin('/api/promotions'))).data.length, 2);

  // --- Pickup slots: public, capped per slot, only for pickup orders.
  check((await admin('/api/settings', { pickupSlots: { enabled: true, intervalMinutes: 15, capacity: 1, leadMinutes: 0 } }, 'PUT')).status, 200);
  const settings = (await json(visitor('/api/settings'))).data;
  check(JSON.parse(settings.pickupSlots), { enabled: true, intervalMinutes: 15, capacity: 1, leadMinutes: 0 });
  const slots = (await json(visitor('/api/pickup-slots'))).data;
  check(slots.enabled, true);
  const plainLine = { menuItemId: 'item-espresso', itemName: 'Espresso', quantity: 1, unitPrice: 120, variants: [] };
  if (slots.slots.length) {
    const slot = slots.slots[0];
    check(slot.remaining, 1);
    check((await publicOrder([plainLine], { orderType: 'dine_in', pickupAt: slot.at })).status, 400);
    check((await publicOrder([plainLine], { orderType: 'pickup', pickupAt: '2000-01-01T00:00:00.000Z' })).status, 409);
    response = await publicOrder([plainLine], { orderType: 'pickup', pickupAt: slot.at });
    check(response.status, 200);
    check((await response.json()).data.pickupAt, slot.at);
    check((await json(visitor('/api/pickup-slots'))).data.slots[0].remaining, 0);
    check((await publicOrder([plainLine], { orderType: 'pickup', pickupAt: slot.at })).status, 409);
  }
  // Pickup without a time still means "as soon as possible".
  check((await publicOrder([plainLine], { orderType: 'pickup' })).status, 200);

  // --- Tips: staff only, untaxed, outside the total, and counted in the cash drawer.
  const tipped = (await json(admin('/api/orders', { orderType: 'dine_in', paymentMethod: 'cash', status: 'completed', tipAmount: 50, items: [plainLine] }))).data;
  check([tipped.totalAmount, tipped.tipAmount], [130.2, 50]);
  check((await admin('/api/orders', { orderType: 'dine_in', paymentMethod: 'cash', tipAmount: -1, items: [plainLine] })).status, 400);
  check((await json(publicOrder([plainLine], { tipAmount: 99 }))).data.tipAmount, 0);
  const day = tipped.createdAt.slice(0, 10);
  const drawer = (await json(admin(`/api/reconciliation?date=${day}&openingCash=0`))).data;
  ok(drawer.expectedCash >= 180.2);
  check((await admin(`/api/orders/${tipped.id}`, { orderType: 'dine_in', paymentMethod: 'cash', discountAmount: 0, tipAmount: 20, items: [plainLine] }, 'PUT')).status, 200);
  check((await db.prepare('SELECT tip_amount FROM orders WHERE id = ?').bind(tipped.id).first()).tip_amount, 20);

  // --- Club stamps and points: earned on completion, redeemed at the till, refunded when the order is cancelled.
  check((await admin('/api/settings', { loyalty: { enabled: true, stampsPerReward: 2, stampCategoryIds: [], spendPerPoint: 100, pointValue: 1 } }, 'PUT')).status, 200);
  const member = (await json(panel('/api/customers', { name: 'Neda', phone: '0912 555 1234' }))).data;
  const balance = async () => (await json(panel('/api/customers'))).data.find(c => c.id === member.id);
  const memberOrder = (extra = {}) => panel('/api/orders', { id: `ord-${crypto.randomUUID()}`, customerId: member.id, orderType: 'dine_in', paymentMethod: 'card', items: [{ ...plainLine, quantity: 2 }], ...extra });
  const first = (await json(memberOrder())).data;
  check([(await balance()).stamps, (await balance()).points], [0, 0]);
  for (const status of ['preparing', 'ready', 'completed']) check((await panel(`/api/orders/${first.id}/status`, { status }, 'PUT')).status, 200);
  check([(await balance()).stamps, (await balance()).points], [2, 2]);
  // A full card is a free item; the till sends the stamps with the discount.
  check((await memberOrder({ loyalty: { stamps: 4 }, items: [{ ...plainLine, discountAmount: 120 }], discountAmount: 120 })).status, 400);
  check((await memberOrder({ loyalty: { stamps: 1 }, items: [{ ...plainLine, discountAmount: 120 }], discountAmount: 120 })).status, 400);
  check((await memberOrder({ loyalty: { points: 2 }, discountAmount: 1 })).status, 400);
  const rewarded = (await json(memberOrder({ loyalty: { stamps: 2, points: 2 }, items: [{ ...plainLine, quantity: 2, discountAmount: 120 }], discountAmount: 122 }))).data;
  check([(await balance()).stamps, (await balance()).points], [0, 0]);
  const ledger = await json(panel(`/api/customers/${member.id}/ledger`));
  check(ledger.data.map(e => e.kind).sort(), ['earn', 'redeem']);
  check((await panel(`/api/orders/${rewarded.id}/status`, { status: 'cancelled' }, 'PUT')).status, 200);
  check([(await balance()).stamps, (await balance()).points], [2, 2]);
  // Hand corrections are admin-only and need a reason.
  check((await panel(`/api/customers/${member.id}/ledger`, { stamps: 1, note: 'Goodwill' })).status, 403);
  check((await admin(`/api/customers/${member.id}/ledger`, { stamps: 1 })).status, 400);
  check((await admin(`/api/customers/${member.id}/ledger`, { stamps: -5, note: 'Oops' })).status, 400);
  check((await json(admin(`/api/customers/${member.id}/ledger`, { stamps: 1, note: 'Goodwill' }))).balance, { stamps: 3, points: 2 });
  // Deleting a completed order takes back what it earned.
  check((await admin(`/api/orders/${first.id}`, undefined, 'DELETE')).status, 200);
  check([(await balance()).stamps, (await balance()).points], [1, 0]);
  // A public order with the member's phone collects stamps, keeps the typed name, and its receipt shows the card.
  response = await publicOrder([{ ...plainLine, quantity: 3 }], { customerName: 'N.', clubPhone: '+98 912 555 1234' });
  const clubOrder = (await response.json()).data;
  check([clubOrder.customerId, clubOrder.customerName], [member.id, 'N.']);
  for (const status of ['preparing', 'ready', 'completed']) await panel(`/api/orders/${clubOrder.id}/status`, { status }, 'PUT');
  check((await balance()).stamps, 4);
  const tracked = (await json(visitor(`/api/orders/${clubOrder.id}/tracking?token=${clubOrder.trackingToken}&receipt=1`))).data;
  check(tracked.receipt.club, { stamps: 4, points: 3, stampsPerReward: 2, earnedStamps: 3, earnedPoints: 3 });
  check(tracked.receipt.lines, [{ name: 'Espresso', options: [], quantity: 3, unitPrice: 120, discountAmount: 0, total: 360 }]);
  check(tracked.telegramUrl, null);
  check(Object.keys((await json(visitor(`/api/orders/${clubOrder.id}/tracking?token=${clubOrder.trackingToken}`))).data).includes('receipt'), false);
  check((await visitor(`/api/orders/${clubOrder.id}/tracking?token=wrong&receipt=1`)).status, 404);

  // --- Receipts on Telegram: the tracking page links to the bot, which answers /start with the receipt in any chat.
  await db.prepare("UPDATE settings SET telegram_bot_token = ?, telegram_chat_id = '42' WHERE id = 'cafe_config'").bind(TOKEN).run();
  const linked = (await json(visitor(`/api/orders/${promoOrder.id}/tracking?token=${promoOrder.trackingToken}&receipt=1`))).data;
  const payload = linked.telegramUrl.match(/^https:\/\/t\.me\/test_cafe_bot\?start=(r[po][0-9a-f]{48})$/)[1];
  ok(payload.length <= 64);
  calls.splice(0);
  const webhook = text => mf.dispatchFetch('http://localhost/telegram/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': createHmac('sha256', SECRET).update(`telegram-webhook:${TOKEN}`).digest('hex') },
    body: JSON.stringify({ update_id: Date.now(), message: { message_id: 1, chat: { id: 999, type: 'private' }, text } })
  });
  await webhook(`/start ${payload}`);
  const receiptMessage = calls.find(c => c.method === 'sendMessage');
  check(receiptMessage.body.chat_id, '999');
  ok(receiptMessage.body.text.includes(promoOrder.orderNumber) && receiptMessage.body.text.includes('Discount'));
  calls.splice(0);
  await webhook(`/start ${payload.slice(0, -1)}${payload.endsWith('0') ? '1' : '0'}`);
  ok(!calls.find(c => c.method === 'sendMessage')?.body.text.includes(promoOrder.orderNumber));

  // --- Suppliers and purchase orders: reorder drafts by supplier, send to Telegram, receive into stock.
  check((await panel('/api/suppliers')).status, 403);
  check((await admin('/api/suppliers', { name: ' ' })).status, 400);
  const supplier = (await json(admin('/api/suppliers', { name: 'Green Leaf Traders', phone: '021 555', leadTimeDays: 2 }))).data;
  const syrupRow = await db.prepare("SELECT * FROM stock_items WHERE id = 'stock-5'").first();
  check((await admin('/api/stock/stock-5', { name: syrupRow.name, category: syrupRow.category, unit: syrupRow.unit, quantity: syrupRow.quantity, unitCost: syrupRow.unit_cost, minThreshold: 4, supplierId: supplier.id }, 'PUT')).status, 200);
  check((await db.prepare("SELECT supplier_id FROM stock_items WHERE id = 'stock-5'").first()).supplier_id, supplier.id);
  let drafts = await json(admin('/api/purchase-orders/reorder', {}));
  ok(drafts.created >= 1);
  const supplierDraft = drafts.data.find(po => po.supplierId === supplier.id);
  check([supplierDraft.status, supplierDraft.supplierName, supplierDraft.lines.map(l => [l.stockItemId, l.quantity])], ['draft', 'Green Leaf Traders', [['stock-5', 5.5]]]);
  check((await json(admin('/api/purchase-orders/reorder', {}))).created, 0);
  check((await admin(`/api/purchase-orders/${supplierDraft.id}`, { lines: [{ stockItemId: 'stock-5', quantity: 0 }] }, 'PUT')).status, 400);
  const sentOrder = (await json(admin(`/api/purchase-orders/${supplierDraft.id}`, { status: 'sent', lines: [{ stockItemId: 'stock-5', quantity: 6, unitCost: 450 }] }, 'PUT'))).data;
  check([sentOrder.status, !!sentOrder.sentAt], ['sent', true]);
  calls.splice(0);
  check((await admin(`/api/purchase-orders/${supplierDraft.id}/telegram`, {})).status, 200);
  ok(calls.find(c => c.method === 'sendMessage').body.text.includes('Vanilla Bean Cold Foam Syrup: 6 liters'));
  const received = (await json(admin(`/api/purchase-orders/${supplierDraft.id}/receive`, { lines: [{ id: sentOrder.lines[0].id, receivedQuantity: 5, unitCost: 500 }] }))).data;
  check([received.status, received.lines[0].receivedQuantity], ['received', 5]);
  near(await stock('stock-5'), 7.5);
  check((await db.prepare("SELECT unit_cost FROM stock_items WHERE id = 'stock-5'").first()).unit_cost, 500);
  check((await admin(`/api/purchase-orders/${supplierDraft.id}/receive`, {})).status, 409);
  check((await admin(`/api/purchase-orders/${supplierDraft.id}`, { notes: 'late' }, 'PUT')).status, 409);
  check((await admin(`/api/purchase-orders/${supplierDraft.id}`, undefined, 'DELETE')).status, 409);
  const manual = (await json(admin('/api/purchase-orders', { supplierId: supplier.id, lines: [{ stockItemId: 'stock-6', quantity: 10, unitCost: 120 }] }))).data;
  check(manual.lines[0].name, 'Artisanal Sourdough Bread Loaves');
  check((await admin(`/api/purchase-orders/${manual.id}`, undefined, 'DELETE')).status, 200);
  check((await admin(`/api/suppliers/${supplier.id}`, undefined, 'DELETE')).status, 200);
  check((await db.prepare("SELECT supplier_id FROM stock_items WHERE id = 'stock-5'").first()).supplier_id, null);

  // --- Waste and shrinkage: waste by reason and cost, and count corrections against recipe use.
  check((await admin('/api/inventory-movements', { stockItemId: 'stock-5', kind: 'waste', quantity: -0.5, notes: '', reason: '' })).status, 400);
  check((await admin('/api/inventory-movements', { stockItemId: 'stock-5', kind: 'waste', quantity: -0.5, notes: '', reason: 'spilled' })).status, 200);
  check((await admin('/api/inventory-movements', { stockItemId: 'stock-5', kind: 'adjustment', quantity: -0.2, notes: 'Count' })).status, 200);
  const report = (await json(admin(`/api/stock-report?from=${day}&to=${day}`))).data;
  check(report.byReason, [{ reason: 'spilled', cost: 250, count: 1 }]);
  check(report.wasteCost, 250);
  check(report.shrinkageCost, 100);
  const syrupReport = report.materials.find(m => m.stockItemId === 'stock-5');
  check([syrupReport.wasted, syrupReport.adjusted, syrupReport.purchased], [0.5, -0.2, 5]);
  check((await admin('/api/stock-report?from=2026-02-01&to=2026-01-01')).status, 400);
  check((await panel(`/api/stock-report?from=${day}&to=${day}`)).status, 403);

  console.log(`Passed ${checks} release 1.2 assertions.`);
} finally {
  await mf.dispose();
}
