import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';
const bundle = await build({ entryPoints: ['src/server.ts'], bundle: true, format: 'esm', platform: 'browser', write: false });
const mf = new Miniflare(convertV4MiniflareOptions({ log: new Log(LogLevel.NONE), modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2025-01-01', d1Databases: { DB: 'test-cafe' }, kvNamespaces: ['KV'], bindings: { ADMIN_PASSWORD: 'test-admin-password', PANEL_PASSWORD: 'test-panel-password', SESSION_SECRET: 'test-session-secret-with-at-least-32-characters', CAFE_DEV_PROXY: 'true' } }));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
let cookie = '';
const request = (path, body, authenticated = false, method) => mf.dispatchFetch(`http://localhost${path}`, {
  method: method || (body === undefined ? 'GET' : 'POST'),
  headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(authenticated ? { Cookie: cookie } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
try {
  for (const host of ['localhost', 'chth.cafe', 'admin.chth.cafe', 'panel.chth.cafe']) {
    for (const path of ['/admin', '/admin/settings', '/panel', '/panel/orders']) {
      check((await mf.dispatchFetch(`http://${host}${path}`)).status, 404);
    }
  }
  const embeddedMigration = await readFile('src/services/operationsMigration.ts','utf8');
  check(embeddedMigration.slice(embeddedMigration.indexOf('`')+1,embeddedMigration.lastIndexOf('`')),await readFile('migrations/0002_operations.sql','utf8')+(await readFile('migrations/0003_sync_and_indexes.sql','utf8')).replace(/^--.*\n/,'')+(await readFile('migrations/0004_cancel_keeps_stock.sql','utf8')).replace(/^--.*\n/,''));
  const db = await mf.getD1Database('DB');
  // Start with the old schema to exercise the upgrade path, then seed real D1.
  const schema = (await readFile('schema.sql','utf8')).replace(/^--.*$/gm,'').replace(/  time_zone TEXT[^\n]*\n/g,'').replace(/  allergens TEXT[^\n]*\n/g,'').replace(/  dietary_labels TEXT[^\n]*\n/g,'');
  const statements = schema.match(/CREATE TRIGGER[\s\S]*?\nEND;|CREATE TABLE[\s\S]*?;|INSERT[\s\S]*?;/g);
  for (const sql of statements) if (!/CREATE TRIGGER|CREATE TABLE IF NOT EXISTS (inventory_movements|reconciliations|order_requests)/.test(sql)) await db.prepare(sql).run();
  // Databases created before cancelling stopped restocking still carry this trigger; the Worker must drop it.
  await db.prepare("CREATE TRIGGER order_cancel_restore AFTER UPDATE OF status ON orders WHEN NEW.status = 'cancelled' BEGIN SELECT 1; END").run();
  await db.prepare("UPDATE settings SET telegram_bot_token='private-test-token', telegram_chat_id='private-chat', notify_sales=0,notify_shifts=0,notify_low_stock=0").run();
  check((await request('/api/orders')).status,401);
  check((await request('/api/admin/settings')).status,401);
  check((await request('/api/staff')).status,401);
  check((await request('/api/settings',{},false,'PUT')).status,401);
  check((await request('/api/auth/login',{password:'wrong'})).status,401);
  let response = await request('/api/auth/login',{password:'test-admin-password'});
  check(response.status,200); cookie=response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'),/HttpOnly/i); checks++;
  check((await (await request('/api/auth/session',undefined,true)).json()).authenticated,true);
  const panelRequest = (path, body, panelCookie = '', method) => mf.dispatchFetch(`http://panel.localhost${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', Cookie: panelCookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  check((await panelRequest('/api/auth/login', {password:'test-admin-password'})).status,401);
  check((await request('/api/auth/login', {password:'test-panel-password'})).status,401);
  const proxiedPanel = await mf.dispatchFetch('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cafe-Dev-Host': 'panel.localhost:3000', Origin: 'http://chth.cafe', 'X-Cafe-Dev-Origin': encodeURIComponent('http://panel.localhost:3000') },
    body: JSON.stringify({ password: 'test-panel-password' })
  });
  check(proxiedPanel.status, 200);
  assert.match(proxiedPanel.headers.get('set-cookie'), /cafe_panel_session=/); checks++;
  check((await mf.dispatchFetch('https://admin.chth.cafe/api/auth/session', { headers: { 'X-Cafe-Dev-Host': 'panel.localhost:3000' } }).then(r => r.json())).workspace, 'admin');
  check((await mf.dispatchFetch('http://localhost/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cafe-Dev-Host': 'panel.localhost:3000', Origin: 'http://other.localhost:3000' }, body: JSON.stringify({ password: 'test-panel-password' }) })).status, 403);
  const panelLogin = await panelRequest('/api/auth/login', {password:'test-panel-password'});
  check(panelLogin.status,200);
  const panelCookie = panelLogin.headers.get('set-cookie').split(';')[0];
  check((await (await panelRequest('/api/auth/session',undefined,panelCookie)).json()).workspace,'panel');
  check((await panelRequest('/api/orders',undefined,panelCookie)).status,200);
  check((await panelRequest('/api/menu/items/item-espresso/stock',{isInStock:true},panelCookie,'PUT')).status,200);
  check((await panelRequest('/api/menu/items/item-espresso',{price:1},panelCookie,'PUT')).status,403);
  check((await panelRequest('/api/admin/settings',undefined,panelCookie)).status,403);
  check((await panelRequest('/api/admin/menu',undefined,panelCookie)).status,403);
  check((await panelRequest('/api/settings',{},panelCookie,'PUT')).status,403);
  check((await panelRequest('/api/staff',{},panelCookie)).status,403);
  check((await panelRequest('/api/expenses',undefined,panelCookie)).status,403);
  check((await panelRequest('/api/analytics',undefined,panelCookie)).status,403);
  check((await panelRequest('/api/orders',undefined,cookie)).status,401);
  check((await mf.dispatchFetch('http://localhost/api/orders',{headers:{Cookie:panelCookie}})).status,401);
  check((await panelRequest('/api/auth/logout',{},panelCookie)).status,200);
  check((await panelRequest('/api/orders',undefined,panelCookie)).status,401);
  check((await request('/api/orders',undefined,true)).status,200);
  check(await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='order_cancel_restore'").first(),null);
  const publicConfig = await (await request('/api/settings',undefined,true)).json();
  check(publicConfig.data.telegramBotToken,undefined); check(publicConfig.data.telegramChatId,undefined);
  check(publicConfig.data.timeZone,'Asia/Tehran');
  const privateConfig = await (await request('/api/admin/settings',undefined,true)).json();
  check(privateConfig.data.telegramBotToken,'private-test-token');
  const publicMenu = await (await request('/api/menu',undefined,true)).json();
  check(publicMenu.data[0].items[0].profitMargin,undefined);
  check((await request('/api/admin/menu')).status,401);
  const hours = Object.fromEntries(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>[d,{open:'00:00',close:'23:59',closed:false}]));
  check((await request('/api/settings',{openHours:JSON.stringify(hours), timeZone:'Asia/Tehran'},true,'PUT')).status,200);
  check((await request('/api/settings',{timeZone:'invalid'},true,'PUT')).status,400);
  // Persist appearance directly to D1 to simulate settings saved by another Worker.
  const savedAppearance = JSON.stringify({ paperTone: 'sage', typography: 'modern', bodyFont: 'system', borderRadius: 16, density: 'compact', motion: 'reduced' });
  await db.prepare('UPDATE settings SET appearance = ? WHERE id = ?').bind(savedAppearance, 'cafe_config').run();
  response = await request('/api/settings', { contactPhone: '555-0123' }, true, 'PUT');
  check(response.status, 200);
  check(JSON.parse((await response.json()).data.appearance), JSON.parse(savedAppearance));
  check(JSON.parse((await db.prepare('SELECT appearance FROM settings WHERE id = ?').bind('cafe_config').first()).appearance), JSON.parse(savedAppearance));
  const replacementAppearance = JSON.stringify({ ...JSON.parse(savedAppearance), paperTone: 'rose' });
  check((await request('/api/settings', { appearance: replacementAppearance }, true, 'PUT')).status, 200);
  check(JSON.parse((await db.prepare('SELECT appearance FROM settings WHERE id = ?').bind('cafe_config').first()).appearance), JSON.parse(replacementAppearance));
  response = await request('/api/menu/items/item-espresso',{allergens:'none',dietaryLabels:'vegan, caffeine'},true,'PUT'); check(response.status,200);
  const menu = await (await request('/api/menu')).json();
  const espresso = menu.data.flatMap(c=>c.items).find(i=>i.id==='item-espresso'); check(espresso.allergens,'none'); check(espresso.dietaryLabels,'vegan, caffeine');
  const orderInput = () => ({ id:`public-${crypto.randomUUID()}`,customerName:'Table 4',orderType:'dine_in',paymentMethod:'cash',status:'completed',discountAmount:100,taxAmount:-500,items:[{menuItemId:'item-espresso',itemName:'Fake name',quantity:1,unitPrice:120,variants:[]}] });
  const underpriced=orderInput();underpriced.items[0].unitPrice=0;
  check((await request('/api/orders',underpriced)).status,409);
  const input=orderInput(); response=await request('/api/orders',input); check(response.status,200);
  const order=(await response.json()).data; check(order.subtotal,120);check(order.taxAmount,10.2);check(order.discountAmount,0);check(order.status,'pending');check(order.totalAmount,130.2);
  check((await db.prepare('SELECT item_name FROM order_items WHERE order_id=?').bind(order.id).first()).item_name,'Espresso');
  const retry=await (await request('/api/orders',input)).json();check(retry.data.id,order.id);check(retry.data.orderNumber,order.orderNumber);
  const collision={...input,customerName:'someone else'}; check((await request('/api/orders',collision)).status,409);
  check((await request(`/api/orders/${order.id}/tracking?token=wrong`)).status,404);
  response=await request(`/api/orders/${order.id}/tracking?token=${order.trackingToken}`); check(response.status,200); const tracking=(await response.json()).data;check(tracking.status,'pending');check(tracking.customer_name,undefined);
  check((await request(`/api/orders/${order.id}/status`,{status:'preparing'},true,'PUT')).status,200);
  check((await request(`/api/orders/${order.id}/status`,{status:'ready'},true,'PUT')).status,200);
  check((await request(`/api/orders/${order.id}/status`,{status:'completed'},true,'PUT')).status,200);
  check((await request(`/api/orders/${order.id}/status`,{status:'arbitrary'},true,'PUT')).status,400);
  const stockBefore=Number((await db.prepare("SELECT quantity FROM stock_items WHERE id='stock-1'").first()).quantity);
  const matcha=orderInput();matcha.discountAmount=0;matcha.items=[{menuItemId:'item-iced-matcha',itemName:'Matcha',quantity:1,unitPrice:280,variants:['var-mc-oat']}];
  response=await request('/api/orders',matcha);check(response.status,200);
  const matchaOrder=(await response.json()).data;
  check(Number((await db.prepare("SELECT quantity FROM stock_items WHERE id='stock-1'").first()).quantity),stockBefore-0.015);
  check((await request('/api/orders',matcha)).status,200);
  check(Number((await db.prepare("SELECT quantity FROM stock_items WHERE id='stock-1'").first()).quantity),stockBefore-0.015);
  const stock1 = async () => Number(Number((await db.prepare("SELECT quantity FROM stock_items WHERE id='stock-1'").first()).quantity).toFixed(6));
  const near = value => Number(value.toFixed(6));
  // Cancelling keeps ingredients deducted, deleting returns them.
  check((await request(`/api/orders/${matchaOrder.id}/status`,{status:'cancelled'},true,'PUT')).status,200);
  check(await stock1(),near(stockBefore-0.015));
  const prepared={...matcha,id:`public-${crypto.randomUUID()}`};
  const preparedOrder=(await (await request('/api/orders',prepared)).json()).data;
  check((await request(`/api/orders/${preparedOrder.id}/status`,{status:'preparing'},true,'PUT')).status,200);
  check((await request(`/api/orders/${preparedOrder.id}/status`,{status:'cancelled'},true,'PUT')).status,200);
  check(await stock1(),near(stockBefore-0.03));
  check((await request(`/api/orders/${preparedOrder.id}`,undefined,true,'DELETE')).status,200);
  check(await stock1(),near(stockBefore-0.015));
  check(await db.prepare('SELECT id FROM orders WHERE id=?').bind(preparedOrder.id).first(),null);
  check(await db.prepare('SELECT id FROM order_items WHERE order_id=?').bind(preparedOrder.id).first(),null);
  check((await request(`/api/orders/${preparedOrder.id}`,undefined,true,'DELETE')).status,404);
  check(await stock1(),near(stockBefore-0.015));
  check((await request(`/api/orders/${matchaOrder.id}`,undefined,true,'DELETE')).status,200);
  check(await stock1(),near(stockBefore));
  // An order cancelled under the old restock-on-cancel rule is not restocked twice.
  const legacy={...matcha,id:`public-${crypto.randomUUID()}`};
  const legacyOrder=(await (await request('/api/orders',legacy)).json()).data;
  await db.prepare("INSERT INTO inventory_movements (id,stock_item_id,kind,quantity,notes,order_id,created_at) SELECT 'return-'||id,stock_item_id,'return',-quantity,'Cancelled before preparation',order_id,created_at FROM inventory_movements WHERE order_id=? AND kind='consumption'").bind(legacyOrder.id).run();
  await db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(legacyOrder.id).run();
  check(await stock1(),near(stockBefore));
  check((await request(`/api/orders/${legacyOrder.id}`,undefined,true,'DELETE')).status,200);
  check(await stock1(),near(stockBefore));
  const staffCookie=(await panelRequest('/api/auth/login',{password:'test-panel-password'})).headers.get('set-cookie').split(';')[0];
  check((await panelRequest(`/api/orders/${matchaOrder.id}`,undefined,staffCookie,'DELETE')).status,403);
  // Atomic rollback: no order survives when one ingredient is insufficient.
  const impossible={...matcha,id:`public-${crypto.randomUUID()}`,items:[{...matcha.items[0],quantity:100}]};
  await db.prepare("UPDATE stock_items SET quantity=0 WHERE id='stock-1'").run();
  check((await request('/api/orders',impossible)).status,409);check(await db.prepare('SELECT id FROM orders WHERE id=?').bind(impossible.id).first(),null);
  check((await request('/api/inventory-movements',{stockItemId:'stock-1',kind:'purchase',quantity:2,notes:'delivery'},true)).status,200);
  check((await request('/api/inventory-movements',{stockItemId:'stock-1',kind:'waste',quantity:-0.5,notes:'spill'},true)).status,200);
  check(Number((await db.prepare("SELECT quantity FROM stock_items WHERE id='stock-1'").first()).quantity),1.5);
  check((await request('/api/inventory-movements',{stockItemId:'stock-1',kind:'waste',quantity:1,notes:'invalid'},true)).status,400);
  check((await request('/api/stock/stock-1',{quantity:3},true,'PUT')).status,200);
  check(Number((await db.prepare("SELECT quantity FROM stock_items WHERE id='stock-1'").first()).quantity),3);
  check((await request('/api/stock/stock-1',{quantity:-2},true,'PUT')).status,400);
  check((await request('/api/inventory-movements')).status,401);
  check((await request('/api/reconciliation?date=2026-10-02')).status,401);
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  response=await request(`/api/reconciliation?date=${date}&openingCash=50`,undefined,true);check(response.status,200);const totals=(await response.json()).data;check(totals.expectedCash,180.2);check(totals.expectedCard,0);
  check((await request('/api/reconciliation',{date,openingCash:50,actualCash:180.2,actualCard:0,notes:'Balanced'},true)).status,200);
  const saved=await db.prepare('SELECT * FROM reconciliations WHERE date=?').bind(date).first();check(saved.expected_cash,180.2);check(saved.actual_cash,180.2);
  // Staff custom entries and historical sales stay available through authenticated paths.
  const manual={...orderInput(),id:`ord-${crypto.randomUUID()}`,discountAmount:0,createdAt:'2026-01-02T12:00:00Z',status:'completed',items:[{menuItemId:'manual-inc-123',itemName:'Manual income',quantity:1,unitPrice:40,variants:[]}]};
  response=await request('/api/orders',manual,true);check(response.status,200);check((await response.json()).data.createdAt,'2026-01-02T12:00:00.000Z');
  check((await request('/api/orders',{...manual,id:`public-${crypto.randomUUID()}`})).status,409);
  // Server write failures must be reported, not masked by the in-memory store.
  check((await request('/api/staff',{id:'invalid-staff'},true)).status,503);
  const cross=await mf.dispatchFetch('http://localhost/api/settings',{method:'PUT',headers:{Origin:'https://evil.example',Cookie:cookie,'Content-Type':'application/json'},body:'{}'});check(cross.status,403);
  check((await request('/api/auth/logout',{},true)).status,200);check((await request('/api/orders',undefined,true)).status,401);
  console.log(`Passed ${checks} Worker/D1 integration assertions.`);
} finally { await mf.dispose(); }
const timeBundle=await build({entryPoints:['src/utils/openingHours.ts'],bundle:true,format:'esm',write:false});
const { getOpeningStatus }=await import(`data:text/javascript;base64,${Buffer.from(timeBundle.outputFiles[0].text).toString('base64')}`);
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const hours=JSON.stringify(Object.fromEntries(days.map(day=>[day,{open:'07:00',close:'19:00',closed:false}])));
check(getOpeningStatus(hours,new Date('2026-10-02T04:00:00Z'),'Asia/Tehran').isOpen,true);
check(getOpeningStatus(hours,new Date('2026-10-02T03:00:00Z'),'Asia/Tehran').isOpen,false);
check(getOpeningStatus(hours,new Date('2026-10-02T03:00:00Z'),'Asia/Tehran').nextOpening.toISOString(),'2026-10-02T03:30:00.000Z');
const overnight=JSON.stringify(Object.fromEntries(days.map(day=>[day,{open:'22:00',close:'02:00',closed:false}])));
check(getOpeningStatus(overnight,new Date('2026-10-02T21:30:00Z'),'Asia/Tehran').isOpen,true);
check(getOpeningStatus(hours,new Date(),'Bad/Timezone').label,'Hours unavailable');
check(getOpeningStatus('{}').isOpen,false);
console.log(`Passed ${checks} total assertions, including café timezone and overnight hours.`);

const apiBundle = await build({entryPoints:['src/services/api.ts'],bundle:true,format:'esm',write:false});
const { readAPIResponse } = await import(`data:text/javascript;base64,${Buffer.from(apiBundle.outputFiles[0].text).toString('base64')}`);
for (const body of ['', '<html>Frontend page</html>', 'null']) {
  await assert.rejects(readAPIResponse(new Response(body)), /café API is unavailable/); checks++;
}
await assert.rejects(readAPIResponse(new Response(JSON.stringify({ message: 'Incorrect password.' }), { status: 401 })), /Incorrect password/); checks++;
check(await readAPIResponse(new Response(JSON.stringify({success:true}))),{success:true});
console.log(`Passed ${checks} assertions, including empty/non-JSON login responses.`);
