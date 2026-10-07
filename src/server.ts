import { Hono, type Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { getOpeningStatus } from './utils/openingHours';
import { store } from './db/store';
import { ensureFeatureTables, dataVersion, bumpDataVersion, publicSettings, trackingToken, registerOperations } from './services/operations';
import { parseAppearance } from './utils/appearance';
import {
  sendTelegramNotification,
  formatSaleMessage,
  formatShiftMessage,
  formatTaskMessage,
  formatStockAlertMessage,
  type FormatContext
} from './services/telegram';
import { registerTelegramBot, runScheduledTelegram, sendDailyReport } from './services/telegramBot';

export type Env = {
  Variables: { authed: boolean; workspace: 'admin' | 'panel' };
  Bindings: {
    CAFE_DEV_PROXY?: string;
    ADMIN_PASSWORD?: string;
    PANEL_PASSWORD?: string;
    SESSION_SECRET?: string;
    DB: D1Database;
    KV: KVNamespace;
    ASSETS: Fetcher;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
  };
};

// Convert snake_case D1 column names to camelCase for frontend compatibility
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    mapped[snakeToCamel(key)] = row[key];
  }
  // Convert D1 integer booleans to actual booleans where needed
  if ('isInStock' in mapped) mapped.isInStock = mapped.isInStock === 1 || mapped.isInStock === true;
  if ('notifySales' in mapped) mapped.notifySales = mapped.notifySales === 1 || mapped.notifySales === true;
  if ('notifyShifts' in mapped) mapped.notifyShifts = mapped.notifyShifts === 1 || mapped.notifyShifts === true;
  if ('notifyTasks' in mapped) mapped.notifyTasks = mapped.notifyTasks === 1 || mapped.notifyTasks === true;
  if ('notifyDailyReport' in mapped) mapped.notifyDailyReport = mapped.notifyDailyReport === 1 || mapped.notifyDailyReport === true;
  if ('notifyLowStock' in mapped) mapped.notifyLowStock = mapped.notifyLowStock === 1 || mapped.notifyLowStock === true;
  return mapped;
}

function mapRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(mapRow);
}

// Schema checks run once per Worker isolate rather than before every request.
const schemaChecks = new Map<string, Promise<void>>();
function onceSchema(name: string, check: () => Promise<void>) {
  let pending = schemaChecks.get(name);
  if (!pending) {
    pending = check();
    schemaChecks.set(name, pending);
    pending.catch(() => schemaChecks.delete(name));
  }
  return pending;
}

function ensureSettingsColumns(db: D1Database) {
  return onceSchema('settings', async () => {
    const alterStatements = [
      `ALTER TABLE settings ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Asia/Tehran'`,
      `ALTER TABLE settings ADD COLUMN appearance TEXT NOT NULL DEFAULT '{}'`,
      'ALTER TABLE settings ADD COLUMN telegram_bot_token TEXT DEFAULT ""',
      'ALTER TABLE settings ADD COLUMN telegram_chat_id TEXT DEFAULT ""',
      'ALTER TABLE settings ADD COLUMN notify_sales INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE settings ADD COLUMN notify_shifts INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE settings ADD COLUMN notify_tasks INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE settings ADD COLUMN notify_daily_report INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE settings ADD COLUMN notify_low_stock INTEGER NOT NULL DEFAULT 1'
    ];
    const table = alterStatements[0].split(' ')[2];
    const { results } = await db.prepare(`PRAGMA table_info(${table})`).all();
    const columns = new Set(results.map(row => row.name));
    for (const stmt of alterStatements) {
      if (!columns.has(stmt.split(' ')[5])) await db.prepare(stmt).run();
    }
  });
}

function ensureStockTables(db: D1Database) {
  return onceSchema('stock', async () => {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS stock_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Tea & Coffee',
          quantity REAL NOT NULL DEFAULT 0.0,
          unit TEXT NOT NULL DEFAULT 'kg',
          unit_cost REAL NOT NULL DEFAULT 0.0,
          total_price REAL NOT NULL DEFAULT 0.0,
          min_threshold REAL NOT NULL DEFAULT 5.0,
          updated_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `).run();
    } catch (e) {}
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS recipes (
          id TEXT PRIMARY KEY,
          menu_item_id TEXT NOT NULL,
          stock_item_id TEXT NOT NULL,
          quantity_required REAL NOT NULL DEFAULT 0.0
        )
      `).run();
    } catch (e) {}
  });
}

function ensureMenuColumns(db: D1Database) {
  return onceSchema('menu', async () => {
    const alterStatements = [
      "ALTER TABLE menu_items ADD COLUMN allergens TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE menu_items ADD COLUMN dietary_labels TEXT NOT NULL DEFAULT ''",
      'ALTER TABLE menu_items ADD COLUMN profit_margin REAL NOT NULL DEFAULT 0.0'
    ];
    const table = alterStatements[0].split(' ')[2];
    const { results } = await db.prepare(`PRAGMA table_info(${table})`).all();
    const columns = new Set(results.map(row => row.name));
    for (const stmt of alterStatements) {
      if (!columns.has(stmt.split(' ')[5])) await db.prepare(stmt).run();
    }
  });
}

function ensureLogsTable(db: D1Database) {
  return onceSchema('logs', async () => {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_name TEXT NOT NULL,
          action TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )
      `).run();
    } catch (e) {
      // Table already exists or SQLite error ignore
    }
  });
}

const app = new Hono<Env>();

// Every API request is same-origin; cookies are never accepted from another origin.
app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const requestUrl = new URL(c.req.url);
  // Only local Workers accept the host supplied by our development proxy.
  const localProxy = c.env.CAFE_DEV_PROXY === 'true' && requestUrl.protocol === 'http:';
  const browserHost = localProxy ? c.req.header('X-Cafe-Dev-Host') : undefined;
  const requestOrigin = browserHost ? `${requestUrl.protocol}//${browserHost}` : requestUrl.origin;
  const forwardedOrigin = localProxy ? c.req.header('X-Cafe-Dev-Origin') : undefined;
  const origin = forwardedOrigin ? decodeURIComponent(forwardedOrigin) : c.req.header('Origin');
  if (origin && origin !== requestOrigin) return c.json({ success: false, message: 'Origin not allowed.' }, 403);
  const workspace = new URL(requestOrigin).hostname.startsWith('panel.') ? 'panel' : 'admin';
  c.set('workspace', workspace);
  const secret = c.env?.SESSION_SECRET;
  const session = secret ? await getSignedCookie(c, secret, `cafe_${workspace}_session`) : false;
  const [sessionId, expires] = typeof session === 'string' ? session.split(':') : [];
  const authed = Boolean(sessionId && expires && Number(expires) > Date.now() && c.env?.KV && await c.env.KV.get(`session:${workspace}:${sessionId}`) === expires);
  const path = c.req.path;
  const publicRead = c.req.method === 'GET' && ['/api/settings', '/api/menu', '/api/auth/session'].includes(path);
  const publicWrite = c.req.method === 'POST' && ['/api/auth/login', '/api/orders'].includes(path);
  const tracking = c.req.method === 'GET' && /^\/api\/orders\/[^/]+\/tracking$/.test(path);
  if (!authed && !publicRead && !publicWrite && !tracking) return c.json({ success: false, message: 'Please sign in.' }, 401);
  const panelAccess = (c.req.method === 'GET' && ['/api/orders', '/api/order-items', '/api/tasks', '/api/staff', '/api/staff/shifts', '/api/stock', '/api/recipes'].includes(path))
    || (c.req.method === 'POST' && ['/api/tasks', '/api/staff/clock-in', '/api/staff/clock-out'].includes(path))
    || (c.req.method === 'PUT' && /^\/api\/(orders\/[^/]+\/status|tasks\/[^/]+\/status|menu\/items\/[^/]+\/stock)$/.test(path))
    || (c.req.method === 'GET' && /^\/api\/menu\/[^/]+\/recipe$/.test(path));
  if (workspace === 'panel' && !publicRead && !publicWrite && !tracking && !path.startsWith('/api/auth/') && !panelAccess) {
    return c.json({ success: false, message: 'This action requires the admin workspace.' }, 403);
  }
  c.set('authed', authed);
  if (!c.env?.DB && !path.startsWith('/api/auth/')) return c.json({ success: false, message: 'The café database is not configured.' }, 503);
  if (c.env?.DB && !path.startsWith('/api/auth/')) {
    await ensureSettingsColumns(c.env.DB);
    await ensureStockTables(c.env.DB);
    await ensureFeatureTables(c.env.DB);
  }
  await next();
  if (c.env?.DB && c.req.method !== 'GET' && !path.startsWith('/api/auth/') && c.res.ok) await bumpDataVersion(c.env.DB);
});
app.onError((error, c) => {
  if (error instanceof SyntaxError) return c.json({ success: false, message: 'Invalid request data.' }, 400);
  if (String(error).includes('Insufficient stock')) return c.json({ success: false, message: 'There is not enough stock for this movement.' }, 409);
  if (String(error).includes('Invalid order status transition')) return c.json({ success: false, message: 'The order status has changed. Refresh and try again.' }, 409);
  console.error('API request failed', error);
  return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
});
app.get('/api/auth/session', async c => {
  let version: number | null = null;
  if (c.env?.DB) {
    try { await ensureFeatureTables(c.env.DB); version = await dataVersion(c.env.DB); } catch (e) { console.warn('Data version unavailable:', e); }
  }
  return c.json({ authenticated: c.get('authed') === true, workspace: c.get('workspace'), version });
});
app.post('/api/auth/login', async c => {
  const workspace = c.get('workspace');
  const password = workspace === 'panel' ? c.env.PANEL_PASSWORD : c.env.ADMIN_PASSWORD;
  if (!password || !c.env.SESSION_SECRET || !c.env.KV) return c.json({ success: false, message: `Set ${workspace === 'panel' ? 'PANEL_PASSWORD' : 'ADMIN_PASSWORD'} and SESSION_SECRET on the server first.` }, 503);
  if (c.env.ADMIN_PASSWORD === c.env.PANEL_PASSWORD) return c.json({ success: false, message: 'Admin and panel passwords must be different.' }, 503);
  const ip = c.req.header('CF-Connecting-IP') || 'local';
  const key = `login:${workspace}:${ip}`;
  const attempts = c.env.KV ? Number(await c.env.KV.get(key) || 0) : 0;
  if (attempts >= 10) return c.json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' }, 429);
  const body = await c.req.json();
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [actual, expected] = await Promise.all([digest(String(body.password || '')), digest(password)]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  if (difference) {
    if (c.env.KV) await c.env.KV.put(key, String(attempts + 1), { expirationTtl: 900 });
    return c.json({ success: false, message: 'Incorrect password.' }, 401);
  }
  if (c.env.KV) await c.env.KV.delete(key);
  const sessionId = crypto.randomUUID();
  const expires = String(Date.now() + 8 * 3600000);
  await c.env.KV.put(`session:${workspace}:${sessionId}`, expires, { expirationTtl: 8 * 3600 });
  await setSignedCookie(c, `cafe_${workspace}_session`, `${sessionId}:${expires}`, c.env.SESSION_SECRET, {
    httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Strict', path: '/', maxAge: 8 * 3600
  });
  return c.json({ success: true });
});
app.post('/api/auth/logout', async c => {
  const workspace = c.get('workspace');
  const session = await getSignedCookie(c, c.env.SESSION_SECRET!, `cafe_${workspace}_session`);
  if (typeof session === 'string') await c.env.KV.delete(`session:${workspace}:${session.split(':')[0]}`);
  deleteCookie(c, `cafe_${workspace}_session`, { path: '/' });
  return c.json({ success: true });
});

registerOperations(app);
registerTelegramBot(app);

// --- 1. Settings & Branding Routes ---
const getSettings = async (c: Context<Env>) => {
  if (c.env?.DB) {
    await ensureSettingsColumns(c.env.DB);
    try {
      const row = await c.env.DB.prepare('SELECT * FROM settings WHERE id = ?').bind('cafe_config').first();
      if (row) {
        return c.json({ source: 'd1_database', data: c.req.path === '/api/admin/settings' ? mapRow(row as Record<string, unknown>) : publicSettings(mapRow(row as Record<string, unknown>)) });
      }
    } catch (e) {
      console.warn('D1 Query Error (settings):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  const settings = store.getSettings();
  return c.json({ source: 'store', data: c.req.path === '/api/admin/settings' ? settings : publicSettings(settings) });
};
app.get('/api/settings', getSettings);
app.get('/api/admin/settings', getSettings);

app.put('/api/settings', async (c) => {
  const body = await c.req.json();
  if (body.timeZone) { try { new Intl.DateTimeFormat('en', { timeZone: body.timeZone }); } catch { return c.json({ success: false, message: 'Invalid café timezone.' }, 400); } }
  const current = c.env?.DB ? await c.env.DB.prepare('SELECT * FROM settings WHERE id = ?').bind('cafe_config').first() : null;
  const savedSettings = { ...store.getSettings(), ...(current ? mapRow(current as Record<string, unknown>) : {}) };
  const updated = { ...savedSettings, ...body, appearance: JSON.stringify(parseAppearance(body.appearance ?? savedSettings.appearance)), updatedAt: new Date().toISOString() };

  if (c.env?.DB) {
    await ensureSettingsColumns(c.env.DB);
    try {
      await c.env.DB.prepare(
        `UPDATE settings SET cafe_name = ?, logo_url = ?, brand_primary = ?, brand_secondary = ?, currency = ?, tax_rate = ?, open_hours = ?, contact_phone = ?, address = ?, telegram_bot_token = ?, telegram_chat_id = ?, notify_sales = ?, notify_shifts = ?, notify_tasks = ?, notify_daily_report = ?, notify_low_stock = ?, appearance = ?, time_zone = ?, updated_at = ? WHERE id = ?`
      ).bind(
        updated.cafeName,
        updated.logoUrl,
        updated.brandPrimary,
        updated.brandSecondary,
        updated.currency,
        updated.taxRate,
        updated.openHours,
        updated.contactPhone,
        updated.address,
        updated.telegramBotToken || '',
        updated.telegramChatId || '',
        updated.notifySales ? 1 : 0,
        updated.notifyShifts ? 1 : 0,
        updated.notifyTasks ? 1 : 0,
        updated.notifyDailyReport ? 1 : 0,
        updated.notifyLowStock ? 1 : 0,
        updated.appearance,
        updated.timeZone || 'Asia/Tehran',
        updated.updatedAt,
        'cafe_config'
      ).run();
    } catch (e) {
      console.warn('D1 Update Error (settings):', e);
      return c.json({ success: false, message: 'Settings could not be saved. Please try again.' }, 503);
    }
  }

  store.updateSettings(updated);
  return c.json({ success: true, message: 'Branding & settings updated', data: updated });
});

// --- 2. Menu & Stock Routes ---
const getMenu = async (c: Context<Env>) => {
  if (c.env?.DB) {
    await ensureMenuColumns(c.env.DB);
    try {
      const { results: categories } = await c.env.DB.prepare('SELECT * FROM categories ORDER BY display_order ASC').all();
      const { results: items } = await c.env.DB.prepare('SELECT * FROM menu_items').all();
      const { results: variants } = await c.env.DB.prepare('SELECT * FROM menu_variants').all();

      if (categories) {
        const mappedCats = mapRows(categories as Record<string, unknown>[]);
        const mappedItems = mapRows(items as Record<string, unknown>[]);
        const mappedVariants = mapRows(variants as Record<string, unknown>[]);
        if (c.req.path !== '/api/admin/menu') mappedItems.forEach(item => { delete item.profitMargin; });
        const publicMenu = mappedCats.map((cat: any) => ({
          ...cat,
          items: mappedItems
            .filter((item: any) => item.categoryId === cat.id)
            .map((item: any) => ({
              ...item,
              variants: mappedVariants.filter((v: any) => v.menuItemId === item.id)
            }))
        }));
        return c.json({ source: 'd1_database', data: publicMenu });
      }
    } catch (e) {
      console.warn('D1 Query Error (menu):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }

  const categories = store.getCategories();
  const items = store.getMenuItems();
  const variants = store.getMenuVariants();

  const publicMenu = categories.map((cat) => ({
    ...cat,
    items: items
      .filter((item) => item.categoryId === cat.id)
      .map((item) => ({
        ...item,
        profitMargin: c.req.path === '/api/admin/menu' ? item.profitMargin : undefined,
        variants: variants.filter((v) => v.menuItemId === item.id)
      }))
  }));

  return c.json({ source: 'store', data: publicMenu });
};
app.get('/api/menu', getMenu);
app.get('/api/admin/menu', getMenu);

app.post('/api/menu/categories', async (c) => {
  const body = await c.req.json();
  const newCat = store.createCategory(body.name, body.icon, body.id, body.displayOrder);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO categories (id, name, display_order, icon) VALUES (?, ?, ?, ?)`
      ).bind(newCat.id, newCat.name, newCat.displayOrder, newCat.icon).run();
    } catch (e) {
      console.warn('D1 Insert Error (category):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Category created', data: newCat });
});

app.put('/api/menu/categories/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updated = store.updateCategory(id, body);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `UPDATE categories SET name = COALESCE(?, name), display_order = COALESCE(?, display_order), icon = COALESCE(?, icon) WHERE id = ?`
      ).bind(
        body.name ?? null,
        body.displayOrder ?? null,
        body.icon ?? null,
        id
      ).run();
    } catch (e) {
      console.warn('D1 Update Error (category):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Category updated', data: updated });
});

app.delete('/api/menu/categories/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteCategory(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM menu_items WHERE category_id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (category):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : deleted });
});

app.put('/api/menu/items/:id/stock', async (c) => {
  const itemId = c.req.param('id');
  const { isInStock } = await c.req.json();
  const updated = store.toggleStock(itemId, isInStock);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('UPDATE menu_items SET is_in_stock = ? WHERE id = ?')
        .bind(isInStock ? 1 : 0, itemId)
        .run();
    } catch (e) {
      console.warn('D1 Update Error (stock):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Stock status updated', data: updated || { id: itemId, isInStock } });
});

app.post('/api/menu/items', async (c) => {
  const body = await c.req.json();
  const itemInput = body.item || body;
  const newItem = store.createMenuItem(itemInput, body.variants || []);

  if (c.env?.DB) {
    await ensureMenuColumns(c.env.DB);
    try {
      await c.env.DB.prepare(
        `INSERT INTO menu_items (id, category_id, name, description, base_price, profit_margin, is_in_stock, image_url, badge, allergens, dietary_labels, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newItem.id,
        newItem.categoryId,
        newItem.name,
        newItem.description || '',
        newItem.basePrice,
        newItem.profitMargin ?? 0.0,
        newItem.isInStock ? 1 : 0,
        newItem.imageUrl || '',
        newItem.badge || '',
        newItem.allergens || '',
        newItem.dietaryLabels || '',
        newItem.createdAt
      ).run();


      if (body.variants && Array.isArray(body.variants)) {
        for (const v of body.variants) {
          const varId = v.id || `var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          await c.env.DB.prepare(
            `INSERT INTO menu_variants (id, menu_item_id, group_name, name, price_modifier) VALUES (?, ?, ?, ?, ?)`
          ).bind(varId, newItem.id, v.groupName, v.name, v.priceModifier || 0.0).run();
        }
      }
    } catch (e) {
      console.warn('D1 Insert Error (menu_item):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Menu item created', data: newItem });
});

app.put('/api/menu/items/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updated = store.updateMenuItem(id, body);

  if (c.env?.DB) {
    await ensureMenuColumns(c.env.DB);
    try {
      await c.env.DB.prepare(
        `UPDATE menu_items SET
           category_id = COALESCE(?, category_id),
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           base_price = COALESCE(?, base_price),
           profit_margin = COALESCE(?, profit_margin),
           is_in_stock = COALESCE(?, is_in_stock),
           image_url = COALESCE(?, image_url),
           badge = COALESCE(?, badge), allergens = COALESCE(?, allergens), dietary_labels = COALESCE(?, dietary_labels)
         WHERE id = ?`
      ).bind(
        body.categoryId ?? null,
        body.name ?? null,
        body.description ?? null,
        body.basePrice ?? null,
        body.profitMargin ?? null,
        body.isInStock !== undefined ? (body.isInStock ? 1 : 0) : null,
        body.imageUrl ?? null,
        body.badge ?? null,
        body.allergens ?? null,
        body.dietaryLabels ?? null,
        id
      ).run();

      if (body.variants && Array.isArray(body.variants)) {
        await c.env.DB.prepare('DELETE FROM menu_variants WHERE menu_item_id = ?').bind(id).run();
        for (const v of body.variants) {
          const varId = v.id || `var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          await c.env.DB.prepare(
            `INSERT INTO menu_variants (id, menu_item_id, group_name, name, price_modifier) VALUES (?, ?, ?, ?, ?)`
          ).bind(varId, id, v.groupName, v.name, v.priceModifier || 0.0).run();
        }
      }
    } catch (e) {
      console.warn('D1 Update Error (menu_item):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, data: updated || { id, ...body } });
});

app.delete('/api/menu/items/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteMenuItem(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM menu_variants WHERE menu_item_id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (menu_item):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true });
});

// --- 2.5 Stock Management & Recipe Routes ---
app.get('/api/stock', async (c) => {
  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM stock_items ORDER BY created_at DESC').all();
      if (results) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (stock):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  return c.json({ source: 'store', data: store.getStockItems() });
});

app.post('/api/stock', async (c) => {
  const body = await c.req.json();
  if ([body.quantity,body.unitCost,body.minThreshold].some(v => v !== undefined && (!Number.isFinite(v) || v < 0))) return c.json({ success: false, message: 'Invalid stock values.' }, 400);
  const newItem = store.addStockItem(body);

  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      const insertStock = c.env.DB.prepare(
        `INSERT INTO stock_items (id, name, category, quantity, unit, unit_cost, total_price, min_threshold, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newItem.id,
        newItem.name,
        newItem.category,
        0,
        newItem.unit,
        newItem.unitCost,
        0,
        newItem.minThreshold,
        newItem.updatedAt,
        newItem.createdAt
      );
      const statements = [insertStock];
      if (newItem.quantity) statements.push(c.env.DB.prepare('INSERT INTO inventory_movements (id,stock_item_id,kind,quantity,notes,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),newItem.id,'purchase',newItem.quantity,'Initial stock',newItem.createdAt));
      await c.env.DB.batch(statements);
    } catch (e) {
      console.warn('D1 Insert Error (stock):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  if (newItem.quantity <= newItem.minThreshold) {
    const alertMsg = (ctx: FormatContext) => formatStockAlertMessage(newItem, ctx);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramNotification(c.env, alertMsg, 'lowStock'));
    } else {
      sendTelegramNotification(c.env, alertMsg, 'lowStock');
    }
  }

  return c.json({ success: true, message: 'Stock item created', data: newItem });
});

app.put('/api/stock/:id', async c => {
  const id = c.req.param('id'); const body = await c.req.json();
  const row = await c.env.DB.prepare('SELECT * FROM stock_items WHERE id = ?').bind(id).first();
  if (!row) return c.json({ success: false, message: 'Stock item not found.' }, 404);
  const updated = { ...mapRow(row as Record<string, unknown>), ...body };
  if ([updated.quantity, updated.unitCost, updated.minThreshold].some(v => !Number.isFinite(v) || v < 0)) return c.json({ success: false, message: 'Stock values must be nonnegative numbers.' }, 400);
  if (updated.unit !== row.unit && Number(row.quantity) !== 0) return c.json({ success: false, message: 'An ingredient’s unit cannot change while it has stock. Create a new ingredient instead.' }, 409);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE stock_items SET name=?,category=?,unit=?,unit_cost=?,total_price=quantity*?,min_threshold=?,updated_at=? WHERE id=?`).bind(updated.name,updated.category,updated.unit,updated.unitCost,updated.unitCost,updated.minThreshold,now,id),
    c.env.DB.prepare(`INSERT INTO inventory_movements (id,stock_item_id,kind,quantity,notes,created_at) SELECT ?,id,'adjustment',?-quantity,'Stock editor adjustment',? FROM stock_items WHERE id=? AND ABS(quantity-?)>0.000001`).bind(crypto.randomUUID(),updated.quantity,now,id,updated.quantity)
  ]);
  return c.json({ success: true, data: updated });
});

app.delete('/api/stock/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteStockItem(id);

  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      await c.env.DB.prepare('DELETE FROM stock_items WHERE id = ?').bind(id).run();
      await c.env.DB.prepare('DELETE FROM recipes WHERE stock_item_id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (stock):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Stock item deleted' });
});

app.get('/api/recipes', async (c) => {
  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM recipes').all();
      if (results) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (recipes):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  return c.json({ source: 'store', data: store.getRecipes() });
});

app.get('/api/menu/:id/recipe', async (c) => {
  const menuItemId = c.req.param('id');
  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM recipes WHERE menu_item_id = ?').bind(menuItemId).all();
      if (results) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (menu recipe):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  return c.json({ source: 'store', data: store.getMenuItemRecipe(menuItemId) });
});

app.post('/api/menu/:id/recipe', async (c) => {
  const menuItemId = c.req.param('id');
  const body = await c.req.json();
  const ingredients: Array<{ stockItemId: string; quantityRequired: number }> = body.ingredients || [];
  if (!Array.isArray(ingredients) || ingredients.some(i=>!i || typeof i.stockItemId !== 'string' || !Number.isFinite(i.quantityRequired) || i.quantityRequired <= 0) || new Set(ingredients.map(i=>i.stockItemId)).size !== ingredients.length) return c.json({ success: false, message: 'Each recipe ingredient needs a positive quantity and must appear only once.' }, 400);
  const updatedRecipes = store.saveMenuItemRecipe(menuItemId, ingredients);

  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      const statements = [c.env.DB.prepare('DELETE FROM recipes WHERE menu_item_id = ?').bind(menuItemId)];
      for (const r of updatedRecipes) {
        statements.push(c.env.DB.prepare(
          'INSERT INTO recipes (id, menu_item_id, stock_item_id, quantity_required) VALUES (?, ?, ?, ?)'
        ).bind(r.id, r.menuItemId, r.stockItemId, r.quantityRequired));
      }
      await c.env.DB.batch(statements);
    } catch (e) {
      console.warn('D1 Insert Error (menu recipe):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Recipe updated', data: updatedRecipes });
});

// --- 3. Staff & PIN Time Tracker Routes ---
app.get('/api/staff', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM staff').all();
      return c.json({ source: 'd1_database', data: mapRows((results || []) as Record<string, unknown>[]) });
    } catch (e) {
      console.warn('D1 Query Error (staff):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  const staffList = store.getStaff();
  return c.json({ data: staffList });
});

app.post('/api/staff', async (c) => {
  const body = await c.req.json();
  const newStaff = store.createStaff(body);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO staff (id, name, role, pin, hourly_rate, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newStaff.id,
        newStaff.name,
        newStaff.role,
        newStaff.pin,
        newStaff.hourlyRate,
        newStaff.status,
        newStaff.createdAt
      ).run();
    } catch (e) {
      console.warn('D1 Insert Error (staff):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Staff member added', data: newStaff });
});

app.put('/api/staff/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const current = c.env?.DB ? await c.env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(id).first() : null;
  const updated = current ? { ...mapRow(current as Record<string, unknown>), ...body } : store.updateStaff(id, body);

  if (c.env?.DB && updated) {
    try {
      await c.env.DB.prepare(
        `UPDATE staff SET name = ?, role = ?, pin = ?, hourly_rate = ?, status = ? WHERE id = ?`
      ).bind(
        updated.name,
        updated.role,
        updated.pin,
        updated.hourlyRate,
        updated.status,
        id
      ).run();
    } catch (e) {
      console.warn('D1 Update Error (staff):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : !!updated, data: updated });
});

app.delete('/api/staff/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteStaff(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM staff WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (staff):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : deleted });
});

app.post('/api/staff/clock-in', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { pin, notes, staffId, shift } = body;
  const result = store.clockIn(pin || '', notes || '', staffId);

  if (c.env?.DB) {
    await ensureLogsTable(c.env.DB);
    try {
      let staffRow: any = null;
      if (staffId) {
        staffRow = await c.env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(staffId).first();
      }
      if (!staffRow && pin) {
        staffRow = await c.env.DB.prepare('SELECT * FROM staff WHERE pin = ? OR LOWER(pin) = LOWER(?)').bind(pin, pin).first();
      }

      const dbStaffId = staffRow ? (staffRow.id as string) : (result.staff?.id || staffId);
      const dbStaffName = staffRow ? (staffRow.name as string) : (result.staff?.name || 'Staff');
      const now = new Date().toISOString();
      const shiftId = shift?.id || result.shift?.id || `shift-${Date.now()}`;
      const clockInTime = shift?.clockIn || result.shift?.clockIn || now;

      if (dbStaffId) {
        await c.env.DB.prepare(
          `INSERT OR REPLACE INTO shifts (id, staff_id, clock_in, clock_out, total_hours, total_pay, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          shiftId,
          dbStaffId,
          clockInTime,
          null,
          0.0,
          0.0,
          notes || '',
          now
        ).run();

        await c.env.DB.prepare(
          `INSERT INTO logs (employee_name, action, timestamp) VALUES (?, ?, ?)`
        ).bind(dbStaffName, 'in', clockInTime).run();
      }
    } catch (e) {
      console.warn('D1 Insert Error (clock-in):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  const staffName = result.staff?.name || 'Staff';
  const shiftObj = result.shift || shift || { id: `shift-${Date.now()}`, staffId, clockIn: new Date().toISOString() };
  const msg = (ctx: FormatContext) => formatShiftMessage('in', staffName, shiftObj as any, ctx);
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(sendTelegramNotification(c.env, msg, 'shifts'));
  } else {
    sendTelegramNotification(c.env, msg, 'shifts');
  }

  return c.json(result.success ? result : { success: true, message: `Clocked in successfully`, shift: shiftObj }, 200);
});

app.post('/api/staff/clock-out', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { pin, notes, staffId, shift } = body;
  const result = store.clockOut(pin || '', notes || '', staffId);

  let shiftRecord: any = null;
  let staffName = result.staff?.name || 'Staff';

  if (c.env?.DB) {
    await ensureLogsTable(c.env.DB);
    try {
      let staffRow: any = null;
      if (staffId) {
        staffRow = await c.env.DB.prepare('SELECT * FROM staff WHERE id = ?').bind(staffId).first();
      }
      if (!staffRow && pin) {
        staffRow = await c.env.DB.prepare('SELECT * FROM staff WHERE pin = ? OR LOWER(pin) = LOWER(?)').bind(pin, pin).first();
      }

      const dbStaffId = staffRow ? (staffRow.id as string) : (result.staff?.id || staffId);
      if (staffRow?.name) staffName = staffRow.name as string;

      if (dbStaffId) {
        let activeDbShift: any = null;
        if (shift?.id) {
          activeDbShift = await c.env.DB.prepare('SELECT * FROM shifts WHERE id = ?').bind(shift.id).first();
        }
        if (!activeDbShift) {
          activeDbShift = await c.env.DB.prepare('SELECT * FROM shifts WHERE staff_id = ? AND clock_out IS NULL ORDER BY created_at DESC LIMIT 1').bind(dbStaffId).first();
        }

        const now = new Date().toISOString();
        const clockOutTime = shift?.clockOut || now;

        if (activeDbShift) {
          const clockInTime = activeDbShift.clock_in || activeDbShift.clockIn;
          const hourlyRate = (staffRow?.hourly_rate as number) || (result.staff?.hourlyRate as number) || 18.5;
          const diffMs = new Date(clockOutTime).getTime() - new Date(clockInTime).getTime();
          const diffHours = shift?.totalHours || Math.max(0.1, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));
          const totalPay = shift?.totalPay || Number((diffHours * hourlyRate).toFixed(2));
          const combinedNotes = notes ? (activeDbShift.notes ? `${activeDbShift.notes} | ${notes}` : notes) : (activeDbShift.notes || '');

          await c.env.DB.prepare(
            `UPDATE shifts SET clock_out = ?, total_hours = ?, total_pay = ?, notes = ? WHERE id = ?`
          ).bind(
            clockOutTime,
            diffHours,
            totalPay,
            combinedNotes,
            activeDbShift.id
          ).run();

          await c.env.DB.prepare(
            `INSERT INTO logs (employee_name, action, timestamp) VALUES (?, ?, ?)`
          ).bind(staffName, 'out', clockOutTime).run();

          shiftRecord = {
            id: activeDbShift.id,
            staffId: dbStaffId,
            clockIn: clockInTime,
            clockOut: clockOutTime,
            totalHours: diffHours,
            totalPay,
            notes: combinedNotes
          };
        }
      }
    } catch (e) {
      console.warn('D1 Update Error (clock-out):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  const shiftToReport = shiftRecord || result.shift || shift;
  if (shiftToReport) {
    const msg = (ctx: FormatContext) => formatShiftMessage('out', staffName, shiftToReport, ctx);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramNotification(c.env, msg, 'shifts'));
    } else {
      sendTelegramNotification(c.env, msg, 'shifts');
    }
  }

  return c.json(
    (result.success || shiftRecord)
      ? { success: true, message: result.message || `Goodbye, ${staffName}! Clocked out successfully.`, shift: shiftRecord || result.shift }
      : { success: false, message: result.message || 'Clock out failed' },
    (result.success || shiftRecord) ? 200 : 400
  );
});

app.get('/api/staff/shifts', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM shifts ORDER BY created_at DESC').all();
      return c.json({ source: 'd1_database', data: mapRows((results || []) as Record<string, unknown>[]) });
    } catch (e) {
      console.warn('D1 Query Error (shifts):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  const shifts = store.getShifts();
  return c.json({ data: shifts });
});

app.post('/api/staff/shifts', async (c) => {
  const body = await c.req.json();
  const newShift = store.createShift(body);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO shifts (id, staff_id, clock_in, clock_out, total_hours, total_pay, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newShift.id,
        newShift.staffId,
        newShift.clockIn,
        newShift.clockOut || null,
        newShift.totalHours || 0.0,
        newShift.totalPay || 0.0,
        newShift.notes || '',
        newShift.createdAt
      ).run();
    } catch (e) {
      console.warn('D1 Insert Error (shifts):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Shift logged', data: newShift });
});

app.put('/api/staff/shifts/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const current = c.env?.DB ? await c.env.DB.prepare('SELECT * FROM shifts WHERE id = ?').bind(id).first() : null;
  const updated = current ? { ...mapRow(current as Record<string, unknown>), ...body } : store.updateShift(id, body);

  if (c.env?.DB && updated) {
    try {
      await c.env.DB.prepare(
        `UPDATE shifts SET clock_in = ?, clock_out = ?, total_hours = ?, total_pay = ?, notes = ? WHERE id = ?`
      ).bind(
        updated.clockIn,
        updated.clockOut || null,
        updated.totalHours || 0.0,
        updated.totalPay || 0.0,
        updated.notes || '',
        id
      ).run();
    } catch (e) {
      console.warn('D1 Update Error (shifts):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : !!updated, data: updated });
});

app.delete('/api/staff/shifts/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteShift(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (shifts):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : deleted });
});

app.get('/api/logs', async (c) => {
  if (c.env?.DB) {
    await ensureLogsTable(c.env.DB);
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all();
      return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
    } catch (e) {
      console.warn('D1 Query Error (logs):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  return c.json({ source: 'store', data: [] });
});

// --- 4. Orders & POS Sales Routes ---
app.get('/api/orders', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();
      if (results) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (orders):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  const orders = store.getOrders();
  return c.json({ source: 'store', data: orders });
});

app.get('/api/order-items', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM order_items').all();
      if (results) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (order_items):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  const orderItems = store.getOrderItems();
  return c.json({ source: 'store', data: orderItems });
});

app.post('/api/orders', async (c) => {
  const body = await c.req.json();
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.some((item: any) =>
    !item || typeof item.menuItemId !== 'string' || !item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1 ||
    !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Array.isArray(item.variants)
  )) {
    return c.json({ success: false, message: 'Please check the items in your order.' }, 400);
  }

  if (!c.env.SESSION_SECRET) return c.json({ success: false, message: 'Ordering is not configured.' }, 503);
  const authed = c.get('authed');
  if (!c.env?.DB) return c.json({ success: false, message: 'Ordering is unavailable until the database is configured.' }, 503);
  if (body.id && (typeof body.id !== 'string' || !/^(public|ord)-[0-9a-f-]{36}$/i.test(body.id) || (!authed && !body.id.startsWith('public-')))) return c.json({ success: false, message: 'Invalid order ID.' }, 400);
  body.id ||= `${authed ? 'ord' : 'public'}-${crypto.randomUUID()}`;
  const fingerprintBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ items: body.items, customerName: body.customerName, orderType: body.orderType, paymentMethod: body.paymentMethod, discountAmount: body.discountAmount || 0 })));
  const fingerprint = Array.from(new Uint8Array(fingerprintBytes), byte=>byte.toString(16).padStart(2,'0')).join('');
  const replay = async () => {
    const row = await c.env.DB.prepare('SELECT o.*, r.fingerprint FROM orders o LEFT JOIN order_requests r ON r.id=o.id WHERE o.id=?').bind(body.id).first();
    if (!row) return null;
    if (row.fingerprint !== fingerprint) return c.json({ success: false, message: 'This request ID already belongs to another order.' }, 409);
    delete row.fingerprint;
    return c.json({ success: true, data: { ...mapRow(row as Record<string,unknown>), trackingToken: await trackingToken(body.id, c.env.SESSION_SECRET) } });
  };
  const previous = await replay(); if (previous) return previous;
  const configRow = await c.env.DB.prepare('SELECT * FROM settings WHERE id = ?').bind('cafe_config').first();
  if (!configRow) return c.json({ success: false, message: 'Café settings are unavailable.' }, 503);
  const config = mapRow(configRow as Record<string, unknown>);
  if (!authed && !getOpeningStatus(String(config.openHours), new Date(), String(config.timeZone || 'Asia/Tehran')).isOpen) {
    return c.json({ success: false, message: 'The café is closed. Please order during opening hours.' }, 409);
  }
  if (body.items.length > 100 || !['dine_in', 'takeout', 'pickup'].includes(body.orderType) || !(authed ? ['cash','card','qr_pay','google_pay','online','bank_transfer'] : ['cash','card']).includes(body.paymentMethod)) {
    return c.json({ success: false, message: 'Invalid order details.' }, 400);
  }
  for (const item of body.items) {
    if (item.quantity > 100) return c.json({ success: false, message: 'Maximum quantity is 100.' }, 400);
    const row = await c.env.DB.prepare('SELECT * FROM menu_items WHERE id = ?').bind(item.menuItemId).first();
    if (!row && authed && /^(custom-|manual-inc-)/.test(item.menuItemId)) continue;
    if (!row || !row.is_in_stock) return c.json({ success: false, message: 'An item is no longer available.' }, 409);
    const { results } = await c.env.DB.prepare('SELECT * FROM menu_variants WHERE menu_item_id = ?').bind(item.menuItemId).all();
    const groups = new Set<string>();
    const selected = [];
    for (const requested of item.variants) {
      const variant = results.find(v => v.id === requested?.id || (typeof requested === 'string' && (v.id === requested || v.name === requested || `${v.group_name}: ${v.name}` === requested)));
      if (!variant || groups.has(String(variant.group_name))) return c.json({ success: false, message: 'Invalid item options.' }, 400);
      groups.add(String(variant.group_name)); selected.push(mapRow(variant));
    }
    if (!authed) for (const variant of results) if (!groups.has(String(variant.group_name))) return c.json({ success: false, message: 'Please select an option from each group.' }, 400);
    const submittedPrice = item.unitPrice;
    item.itemName = row.name;
    item.unitPrice = Number((Number(row.base_price) + selected.reduce((sum, v) => sum + Number(v.priceModifier), 0)).toFixed(2));
    if (!authed && Math.abs(submittedPrice - item.unitPrice) > 0.005) return c.json({ success: false, message: 'Prices have changed. Review your order and try again.' }, 409);
    item.variants = selected;
  }
  const subtotal = Number(body.items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0).toFixed(2));
  const discountAmount = authed ? Number(body.discountAmount || 0) : 0;
  if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) return c.json({ success: false, message: 'Invalid discount.' }, 400);
  const taxAmount = Number(((subtotal - discountAmount) * Number(config.taxRate) / 100).toFixed(2));
  if (!Number.isFinite(taxAmount) || taxAmount < 0) throw new Error('Invalid configured tax rate');
  if (body.customerName && (typeof body.customerName !== 'string' || body.customerName.length > 100)) return c.json({ success: false, message: 'Customer name is too long.' }, 400);
  if (authed && body.createdAt && !Number.isFinite(Date.parse(body.createdAt))) return c.json({ success: false, message: 'Invalid order date.' }, 400);
  if (body.id && (typeof body.id !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(body.id))) return c.json({ success: false, message: 'Invalid order ID.' }, 400);
  const orderData = {
    id: body.id || `ord-${crypto.randomUUID()}`,
    orderNumber: `#${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    customerName: body.customerName || 'Guest Customer',
    orderType: body.orderType || 'dine_in',
    subtotal, taxAmount, discountAmount,
    totalAmount: Number((subtotal - discountAmount + taxAmount).toFixed(2)),
    paymentMethod: body.paymentMethod || 'card',
    status: authed && body.status === 'completed' ? 'completed' : 'pending',
    createdAt: authed && body.createdAt ? new Date(body.createdAt).toISOString() : new Date().toISOString()
  };

  if (c.env?.DB) {
    try {
      const existing = await replay(); if (existing) return existing;
      // D1 batch is transactional: a failed item insert rolls back the whole order.
      // A strict order INSERT also makes concurrent retries of the same ID safe.
      const statements = [c.env.DB.prepare(
        `INSERT INTO orders (id, order_number, customer_name, order_type, subtotal, tax_amount, discount_amount, total_amount, payment_method, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderData.id, orderData.orderNumber, orderData.customerName, orderData.orderType,
        orderData.subtotal, orderData.taxAmount, orderData.discountAmount,
        orderData.totalAmount, orderData.paymentMethod, orderData.status, orderData.createdAt
      )];
      body.items.forEach((item: any, index: number) => {
        statements.push(c.env.DB.prepare(
          `INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, variants_json, item_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          `${orderData.id}-item-${index}`, orderData.id, item.menuItemId, item.itemName,
          item.quantity, item.unitPrice, JSON.stringify(item.variants),
          Number((item.unitPrice * item.quantity).toFixed(2))
        ));
      });
      statements.push(c.env.DB.prepare('INSERT INTO order_requests (id,fingerprint) VALUES (?,?)').bind(orderData.id,fingerprint));
      statements.push(c.env.DB.prepare(`INSERT INTO inventory_movements (id,stock_item_id,kind,quantity,notes,order_id,created_at)
        SELECT ? || '-' || r.stock_item_id, r.stock_item_id, 'consumption', -SUM(r.quantity_required * oi.quantity), 'Order ingredients', ?, ?
        FROM recipes r JOIN order_items oi ON oi.menu_item_id = r.menu_item_id WHERE oi.order_id = ? AND r.quantity_required > 0 GROUP BY r.stock_item_id`).bind(orderData.id, orderData.id, orderData.createdAt, orderData.id));
      await c.env.DB.batch(statements);
    } catch (error) {
      // Another request may have committed this same order while this batch waited.
      try {
        const existing = await replay(); if (existing) return existing;
      } catch {}
      console.warn('D1 order transaction failed:', error);
      return c.json({ success: false, message: String(error).includes('Insufficient stock') ? 'There are not enough ingredients for this order. Please change your order or ask staff.' : 'Your order could not be saved. Please try again.' }, String(error).includes('Insufficient stock') ? 409 : 503);
    }
  } else {
    const existing = store.getOrders().find(order => order.id === orderData.id);
    if (existing) return c.json({ success: true, data: existing });
    store.recordConfirmedOrder(orderData, body.items);
  }

  const msg = (ctx: FormatContext) => formatSaleMessage(orderData, body.items, ctx);
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(sendTelegramNotification(c.env, msg, 'sales'));
  } else {
    void sendTelegramNotification(c.env, msg, 'sales');
  }
  return c.json({ success: true, message: 'Order received', data: { ...orderData, trackingToken: await trackingToken(orderData.id, c.env.SESSION_SECRET) } });
});

app.delete('/api/orders/:id', async (c) => {
  const id = c.req.param('id');
  const movements = await c.env.DB.prepare('SELECT id FROM inventory_movements WHERE order_id = ? LIMIT 1').bind(id).first();
  if (movements) return c.json({ success: false, message: 'Orders with inventory movements must be cancelled instead of deleted to preserve the audit trail.' }, 409);
  const deleted = store.deleteOrder(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (orders):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : deleted });
});

app.put('/api/orders/:id/status', async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json();
  if (!['pending','preparing','ready','completed','cancelled'].includes(status)) return c.json({ success: false, message: 'Invalid order status.' }, 400);
  const updated = store.updateOrderStatus(id, status);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();
    } catch (e) {
      console.warn('D1 Update Error (orders):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : !!updated, data: updated });
});


// --- 5. Expenses & Financial Analytics Routes ---
app.get('/api/expenses', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all();
      if (results) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (expenses):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  const expenses = store.getExpenses();
  return c.json({ data: expenses });
});

app.post('/api/expenses', async (c) => {
  const body = await c.req.json();

  // If the body already has a pre-computed id (sent from client store.createExpense),
  // use it directly. Otherwise fall back to creating via the in-memory store.
  let expenseData: any;
  if (body.id && body.createdAt) {
    expenseData = body;
  } else {
    expenseData = store.createExpense(body);
  }

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO expenses (id, category, description, amount, date, payment_method, logged_by_staff_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        expenseData.id,
        expenseData.category,
        expenseData.description,
        expenseData.amount,
        expenseData.date,
        expenseData.paymentMethod,
        expenseData.loggedByStaffId || null,
        expenseData.createdAt
      ).run();
    } catch (e) {
      console.warn('D1 Insert Error (expenses):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Expense logged successfully', data: expenseData });
});

app.delete('/api/expenses/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteExpense(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (expenses):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : deleted });
});

app.get('/api/analytics', async c => {
  const db = c.env.DB;
  const sales = await db.prepare("SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS count FROM orders WHERE status='completed'").first();
  const costs = await db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM expenses').first();
  const wages = await db.prepare('SELECT COALESCE(SUM(total_pay),0) AS total FROM shifts').first();
  const categories = (await db.prepare('SELECT category, SUM(amount) AS total FROM expenses GROUP BY category').all()).results;
  const totalSalesRevenue=Number(sales?.revenue || 0),totalOrdersCount=Number(sales?.count || 0),totalManualExpenses=Number(costs?.total || 0),totalLaborWages=Number(wages?.total || 0);
  const combinedExpenses=totalManualExpenses+totalLaborWages,netProfit=totalSalesRevenue-combinedExpenses;
  const categoryTotals=Object.fromEntries(categories.map(row=>[String(row.category),Number(row.total)]));
  categoryTotals['Labor Wages (Staff)']=(categoryTotals['Labor Wages (Staff)'] || 0)+totalLaborWages;
  return c.json({data:{totalSalesRevenue,totalOrdersCount,totalManualExpenses,totalLaborWages,combinedExpenses,netProfit,profitMargin:totalSalesRevenue?Number((netProfit/totalSalesRevenue*100).toFixed(1)):0,averageOrderValue:totalOrdersCount?Number((totalSalesRevenue/totalOrdersCount).toFixed(2)):0,categoryTotals}});
});

// --- 6. Task Manager Routes ---
app.get('/api/tasks', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
      if (results) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (tasks):', e);
      return c.json({ success: false, message: 'Data is temporarily unavailable. Please try again.' }, 503);
    }
  }
  const tasks = store.getTasks();
  return c.json({ data: tasks });
});

app.post('/api/tasks', async (c) => {
  const body = await c.req.json();

  // If the body already has a pre-computed id (sent from client store.createTask),
  // use it directly. Otherwise fall back to creating via the in-memory store.
  let taskData: any;
  if (body.id && body.createdAt) {
    taskData = body;
  } else {
    taskData = store.createTask(body);
  }

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO tasks (id, title, description, category, priority, status, assigned_staff_id, due_date, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        taskData.id,
        taskData.title,
        taskData.description,
        taskData.category,
        taskData.priority,
        taskData.status,
        taskData.assignedStaffId || null,
        taskData.dueDate || '',
        taskData.completedAt || null,
        taskData.createdAt
      ).run();
    } catch (e) {
      console.warn('D1 Insert Error (tasks):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: true, message: 'Task created', data: taskData });
});

app.put('/api/tasks/:id/status', async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json();
  const updated = store.updateTaskStatus(id, status);

  if (c.env?.DB) {
    try {
      const now = status === 'completed' ? new Date().toISOString() : null;
      await c.env.DB.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?').bind(status, now, id).run();
    } catch (e) {
      console.warn('D1 Update Error (tasks):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  if (status === 'completed' && updated) {
    const staffName = updated.assignedStaffId ? (store.getStaff().find(s => s.id === updated.assignedStaffId)?.name) : undefined;
    const msg = (ctx: FormatContext) => formatTaskMessage(updated, staffName, ctx);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramNotification(c.env, msg, 'tasks'));
    } else {
      sendTelegramNotification(c.env, msg, 'tasks');
    }
  }

  return c.json({ success: c.env?.DB ? true : !!updated, data: updated });
});

app.delete('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteTask(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (tasks):', e);
      return c.json({ success: false, message: 'The change could not be saved. Please try again.' }, 503);
    }
  }

  return c.json({ success: c.env?.DB ? true : deleted });
});

app.get('/api/kv-cache', async (c) => {
  const snapshot = store.getKVCache();
  return c.json({ data: snapshot });
});

// --- Telegram Test & Daily Financial Report ---
app.post('/api/telegram/test', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { botToken, chatId } = body;
  const testMessage = `🤖 <b>TELEGRAM NOTIFICATION TEST</b>\n\nYour Telegram bot is successfully connected to <b>CHTH Cafe Manager</b>!\n\n<i>Timestamp: ${new Date().toLocaleString()}</i>`;

  const result = await sendTelegramNotification(c.env, testMessage, 'sales', { botToken, chatId });
  return c.json(result);
});

app.post('/api/telegram/daily-report', async (c) => {
  const result = await sendDailyReport(c.env, undefined, true);
  return c.json(result);
});

// --- 7. Host-selected SPA fallback; former dashboard path aliases are removed. ---
app.get('*', async (c) => {
  if (c.req.path.startsWith('/api') || /^\/(admin|panel)(\/|$)/.test(c.req.path)) {
    return c.notFound();
  }

  if (c.env?.ASSETS) {
    const assetRes = await c.env.ASSETS.fetch(c.req.raw);
    if (assetRes.status !== 404) {
      return assetRes;
    }
    const indexUrl = new URL('/index.html', c.req.url);
    return c.env.ASSETS.fetch(indexUrl);
  }

  return c.text('Cloudflare Assets Binding Not Configured', 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Env['Bindings'], ctx: any) {
    if (ctx?.waitUntil) {
      ctx.waitUntil(runScheduledTelegram(env, new Date(event?.scheduledTime || Date.now())));
    } else {
      await runScheduledTelegram(env, new Date(event?.scheduledTime || Date.now()));
    }
  }
};
