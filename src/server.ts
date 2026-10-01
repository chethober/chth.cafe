import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { store } from './db/store';
import {
  sendTelegramNotification,
  formatSaleMessage,
  formatShiftMessage,
  formatTaskMessage,
  formatDailyFinancialReportMessage,
  formatStockAlertMessage
} from './services/telegram';

export type Env = {
  Bindings: {
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

async function ensureTelegramSettingsColumns(db: D1Database) {
  const alterStatements = [
    'ALTER TABLE settings ADD COLUMN telegram_bot_token TEXT DEFAULT ""',
    'ALTER TABLE settings ADD COLUMN telegram_chat_id TEXT DEFAULT ""',
    'ALTER TABLE settings ADD COLUMN notify_sales INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE settings ADD COLUMN notify_shifts INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE settings ADD COLUMN notify_tasks INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE settings ADD COLUMN notify_daily_report INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE settings ADD COLUMN notify_low_stock INTEGER NOT NULL DEFAULT 1'
  ];
  for (const stmt of alterStatements) {
    try {
      await db.prepare(stmt).run();
    } catch (e) {
      // Column already exists or SQLite error ignore
    }
  }
}

async function ensureStockTables(db: D1Database) {
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
}

async function ensureMenuColumns(db: D1Database) {
  const alterStatements = [
    'ALTER TABLE menu_items ADD COLUMN profit_margin REAL NOT NULL DEFAULT 0.0'
  ];
  for (const stmt of alterStatements) {
    try {
      await db.prepare(stmt).run();
    } catch (e) {
      // Column already exists or SQLite error ignore
    }
  }
}

async function ensureLogsTable(db: D1Database) {
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
}

const app = new Hono<Env>();

// Enable CORS for all API routes
app.use('/api/*', cors());

// --- 1. Settings & Branding Routes ---
app.get('/api/settings', async (c) => {
  if (c.env?.DB) {
    await ensureTelegramSettingsColumns(c.env.DB);
    try {
      const row = await c.env.DB.prepare('SELECT * FROM settings WHERE id = ?').bind('cafe_config').first();
      if (row) {
        return c.json({ source: 'd1_database', data: mapRow(row as Record<string, unknown>) });
      }
    } catch (e) {
      console.warn('D1 Query Error (settings):', e);
    }
  }
  const settings = store.getSettings();
  return c.json({ source: 'store', data: settings });
});

app.put('/api/settings', async (c) => {
  const body = await c.req.json();
  const updated = store.updateSettings(body);

  if (c.env?.DB) {
    await ensureTelegramSettingsColumns(c.env.DB);
    try {
      await c.env.DB.prepare(
        `UPDATE settings SET cafe_name = ?, logo_url = ?, brand_primary = ?, brand_secondary = ?, currency = ?, tax_rate = ?, open_hours = ?, contact_phone = ?, address = ?, telegram_bot_token = ?, telegram_chat_id = ?, notify_sales = ?, notify_shifts = ?, notify_tasks = ?, notify_daily_report = ?, notify_low_stock = ?, updated_at = ? WHERE id = ?`
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
        updated.updatedAt,
        'cafe_config'
      ).run();
    } catch (e) {
      console.warn('D1 Update Error (settings):', e);
    }
  }

  return c.json({ success: true, message: 'Branding & settings updated', data: updated });
});

// --- 2. Menu & Stock Routes ---
app.get('/api/menu', async (c) => {
  if (c.env?.DB) {
    await ensureMenuColumns(c.env.DB);
    try {
      const { results: categories } = await c.env.DB.prepare('SELECT * FROM categories ORDER BY display_order ASC').all();
      const { results: items } = await c.env.DB.prepare('SELECT * FROM menu_items').all();
      const { results: variants } = await c.env.DB.prepare('SELECT * FROM menu_variants').all();

      if (categories && categories.length > 0) {
        const mappedCats = mapRows(categories as Record<string, unknown>[]);
        const mappedItems = mapRows(items as Record<string, unknown>[]);
        const mappedVariants = mapRows(variants as Record<string, unknown>[]);
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
        variants: variants.filter((v) => v.menuItemId === item.id)
      }))
  }));

  return c.json({ source: 'store', data: publicMenu });
});

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
    }
  }

  return c.json({ success: deleted });
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
        `INSERT INTO menu_items (id, category_id, name, description, base_price, profit_margin, is_in_stock, image_url, badge, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
           badge = COALESCE(?, badge) 
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
      if (results && results.length > 0) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (stock):', e);
    }
  }
  return c.json({ source: 'store', data: store.getStockItems() });
});

app.post('/api/stock', async (c) => {
  const body = await c.req.json();
  const newItem = store.addStockItem(body);

  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO stock_items (id, name, category, quantity, unit, unit_cost, total_price, min_threshold, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newItem.id,
        newItem.name,
        newItem.category,
        newItem.quantity,
        newItem.unit,
        newItem.unitCost,
        newItem.totalPrice,
        newItem.minThreshold,
        newItem.updatedAt,
        newItem.createdAt
      ).run();
    } catch (e) {
      console.warn('D1 Insert Error (stock):', e);
    }
  }

  if (newItem.quantity <= newItem.minThreshold) {
    const currency = store.getSettings().currency || '₹';
    const alertMsg = formatStockAlertMessage(newItem, currency);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramNotification(c.env, alertMsg, 'lowStock'));
    } else {
      sendTelegramNotification(c.env, alertMsg, 'lowStock');
    }
  }

  return c.json({ success: true, message: 'Stock item created', data: newItem });
});

app.put('/api/stock/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updated = store.updateStockItem(id, body);

  if (c.env?.DB && updated) {
    await ensureStockTables(c.env.DB);
    try {
      await c.env.DB.prepare(
        `UPDATE stock_items SET name = ?, category = ?, quantity = ?, unit = ?, unit_cost = ?, total_price = ?, min_threshold = ?, updated_at = ? WHERE id = ?`
      ).bind(
        updated.name,
        updated.category,
        updated.quantity,
        updated.unit,
        updated.unitCost,
        updated.totalPrice,
        updated.minThreshold,
        updated.updatedAt,
        id
      ).run();
    } catch (e) {
      console.warn('D1 Update Error (stock):', e);
    }
  }

  if (updated && updated.quantity <= updated.minThreshold) {
    const currency = store.getSettings().currency || '₹';
    const alertMsg = formatStockAlertMessage(updated, currency);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramNotification(c.env, alertMsg, 'lowStock'));
    } else {
      sendTelegramNotification(c.env, alertMsg, 'lowStock');
    }
  }

  return c.json({ success: true, message: 'Stock item updated', data: updated });
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
    }
  }

  return c.json({ success: true, message: 'Stock item deleted' });
});

app.get('/api/recipes', async (c) => {
  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM recipes').all();
      if (results && results.length > 0) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (recipes):', e);
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
    }
  }
  return c.json({ source: 'store', data: store.getMenuItemRecipe(menuItemId) });
});

app.post('/api/menu/:id/recipe', async (c) => {
  const menuItemId = c.req.param('id');
  const body = await c.req.json();
  const ingredients: Array<{ stockItemId: string; quantityRequired: number }> = body.ingredients || [];
  const updatedRecipes = store.saveMenuItemRecipe(menuItemId, ingredients);

  if (c.env?.DB) {
    await ensureStockTables(c.env.DB);
    try {
      await c.env.DB.prepare('DELETE FROM recipes WHERE menu_item_id = ?').bind(menuItemId).run();
      for (const r of updatedRecipes) {
        await c.env.DB.prepare(
          'INSERT INTO recipes (id, menu_item_id, stock_item_id, quantity_required) VALUES (?, ?, ?, ?)'
        ).bind(r.id, r.menuItemId, r.stockItemId, r.quantityRequired).run();
      }
    } catch (e) {
      console.warn('D1 Insert Error (menu recipe):', e);
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
    }
  }

  return c.json({ success: true, message: 'Staff member added', data: newStaff });
});

app.put('/api/staff/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updated = store.updateStaff(id, body);

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
    }
  }

  return c.json({ success: !!updated, data: updated });
});

app.delete('/api/staff/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteStaff(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM staff WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (staff):', e);
    }
  }

  return c.json({ success: deleted });
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
    }
  }

  const staffName = result.staff?.name || 'Staff';
  const shiftObj = result.shift || shift || { id: `shift-${Date.now()}`, staffId, clockIn: new Date().toISOString() };
  const currency = store.getSettings().currency || '₹';
  const msg = formatShiftMessage('in', staffName, shiftObj as any, currency);
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
    }
  }

  const shiftToReport = shiftRecord || result.shift || shift;
  if (shiftToReport) {
    const currency = store.getSettings().currency || '₹';
    const msg = formatShiftMessage('out', staffName, shiftToReport, currency);
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
    }
  }

  return c.json({ success: true, message: 'Shift logged', data: newShift });
});

app.put('/api/staff/shifts/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updated = store.updateShift(id, body);

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
    }
  }

  return c.json({ success: !!updated, data: updated });
});

app.delete('/api/staff/shifts/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteShift(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (shifts):', e);
    }
  }

  return c.json({ success: deleted });
});

app.get('/api/logs', async (c) => {
  if (c.env?.DB) {
    await ensureLogsTable(c.env.DB);
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all();
      return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
    } catch (e) {
      console.warn('D1 Query Error (logs):', e);
    }
  }
  return c.json({ source: 'store', data: [] });
});

// --- 4. Orders & POS Sales Routes ---
app.get('/api/orders', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();
      if (results && results.length > 0) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (orders):', e);
    }
  }
  const orders = store.getOrders();
  return c.json({ source: 'store', data: orders });
});

app.get('/api/order-items', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM order_items').all();
      if (results && results.length > 0) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (order_items):', e);
    }
  }
  const orderItems = store.getOrderItems();
  return c.json({ source: 'store', data: orderItems });
});

app.post('/api/orders', async (c) => {
  const body = await c.req.json();
  
  // If the body already has a pre-computed id (sent from client store.createOrder),
  // use it directly. Otherwise fall back to creating via the in-memory store.
  let orderData: any;
  if (body.id && body.orderNumber) {
    orderData = body;
  } else {
    orderData = store.createOrder(body);
  }

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO orders (id, order_number, customer_name, order_type, subtotal, tax_amount, discount_amount, total_amount, payment_method, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderData.id,
        orderData.orderNumber,
        orderData.customerName,
        orderData.orderType || 'dine_in',
        orderData.subtotal,
        orderData.taxAmount,
        orderData.discountAmount,
        orderData.totalAmount,
        orderData.paymentMethod,
        orderData.status,
        orderData.createdAt
      ).run();

      // Insert line items into D1 order_items table
      if (Array.isArray(body.items) && body.items.length > 0) {
        for (let idx = 0; idx < body.items.length; idx++) {
          const item = body.items[idx];
          const itemId = item.id || `item-ord-${Date.now()}-${idx}`;
          const itemTotal = Number(((item.unitPrice || 0) * (item.quantity || 1)).toFixed(2));
          const variantsJson = JSON.stringify(item.variants || []);

          await c.env.DB.prepare(
            `INSERT OR REPLACE INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, variants_json, item_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            itemId,
            orderData.id,
            item.menuItemId || '',
            item.itemName || 'Item',
            item.quantity || 1,
            item.unitPrice || 0,
            variantsJson,
            itemTotal
          ).run();
        }
      }
    } catch (e) {
      console.warn('D1 Insert Error (orders/order_items):', e);
    }
  }

  // Trigger Telegram Sales Notification
  if (orderData) {
    const currency = store.getSettings().currency || '₹';
    const msg = formatSaleMessage(orderData, body.items || [], currency);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramNotification(c.env, msg, 'sales'));
    } else {
      sendTelegramNotification(c.env, msg, 'sales');
    }
  }

  return c.json({ success: true, message: 'Order created successfully', data: orderData });
});

app.delete('/api/orders/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteOrder(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (orders):', e);
    }
  }

  return c.json({ success: deleted });
});

app.put('/api/orders/:id/status', async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json();
  const updated = store.updateOrderStatus(id, status);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();
    } catch (e) {
      console.warn('D1 Update Error (orders):', e);
    }
  }

  return c.json({ success: !!updated, data: updated });
});


// --- 5. Expenses & Financial Analytics Routes ---
app.get('/api/expenses', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all();
      if (results && results.length > 0) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (expenses):', e);
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
    }
  }

  return c.json({ success: deleted });
});

app.get('/api/analytics', async (c) => {
  const analytics = store.getFinancialAnalytics();
  return c.json({ data: analytics });
});

// --- 6. Task Manager Routes ---
app.get('/api/tasks', async (c) => {
  if (c.env?.DB) {
    try {
      const { results } = await c.env.DB.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
      if (results && results.length > 0) {
        return c.json({ source: 'd1_database', data: mapRows(results as Record<string, unknown>[]) });
      }
    } catch (e) {
      console.warn('D1 Query Error (tasks):', e);
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
    }
  }

  if (status === 'completed' && updated) {
    const staffName = updated.assignedStaffId ? (store.getStaff().find(s => s.id === updated.assignedStaffId)?.name) : undefined;
    const msg = formatTaskMessage(updated, staffName);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(sendTelegramNotification(c.env, msg, 'tasks'));
    } else {
      sendTelegramNotification(c.env, msg, 'tasks');
    }
  }

  return c.json({ success: !!updated, data: updated });
});

app.delete('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = store.deleteTask(id);

  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
    } catch (e) {
      console.warn('D1 Delete Error (tasks):', e);
    }
  }

  return c.json({ success: deleted });
});

app.get('/api/kv-cache', async (c) => {
  const snapshot = store.getKVCache();
  return c.json({ data: snapshot });
});

// --- Telegram Test & Daily Financial Report Helpers ---
export async function sendDailyFinancialReport(env: any): Promise<{ success: boolean; error?: string }> {
  try {
    let ordersList: any[] = [];
    let expensesList: any[] = [];
    let currency = '₹';

    if (env?.DB) {
      try {
        const { results: orders } = await env.DB.prepare('SELECT * FROM orders').all();
        const { results: expenses } = await env.DB.prepare('SELECT * FROM expenses').all();
        const settingsRow = await env.DB.prepare('SELECT currency FROM settings WHERE id = ?').bind('cafe_config').first();
        if (orders) ordersList = mapRows(orders as Record<string, unknown>[]);
        if (expenses) expensesList = mapRows(expenses as Record<string, unknown>[]);
        if (settingsRow?.currency) currency = settingsRow.currency as string;
      } catch (e) {
        console.warn('D1 Query error during daily report generation:', e);
      }
    }

    if (ordersList.length === 0) ordersList = store.getOrders();
    if (expensesList.length === 0) expensesList = store.getExpenses();
    if (!currency || currency === '₹') currency = store.getSettings().currency || '₹';

    const todayStr = new Date().toISOString().slice(0, 10);
    
    // Filter today's completed orders
    let todayOrders = ordersList.filter((o: any) => {
      const dateStr = (o.createdAt || '').slice(0, 10);
      return dateStr === todayStr && o.status !== 'cancelled';
    });

    // Fallback: If no orders exist specifically for today (e.g. testing in dev), use all orders
    if (todayOrders.length === 0 && ordersList.length > 0) {
      todayOrders = ordersList.filter((o: any) => o.status !== 'cancelled');
    }

    let todayExpenses = expensesList.filter((e: any) => {
      const dateStr = (e.date || e.createdAt || '').slice(0, 10);
      return dateStr === todayStr;
    });

    if (todayExpenses.length === 0 && expensesList.length > 0) {
      todayExpenses = expensesList;
    }

    const totalRevenue = todayOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
    const totalExpenses = todayExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const cashTotal = todayOrders.filter((o: any) => o.paymentMethod === 'cash').reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
    const cardTotal = todayOrders.filter((o: any) => o.paymentMethod === 'card').reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
    const qrTotal = todayOrders.filter((o: any) => o.paymentMethod === 'qr_pay').reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);

    const messageHtml = formatDailyFinancialReportMessage({
      dateStr: todayStr,
      totalRevenue,
      totalOrders: todayOrders.length,
      totalExpenses,
      netProfit,
      cashTotal,
      cardTotal,
      qrTotal,
      currency
    });

    return await sendTelegramNotification(env, messageHtml, 'dailyReport');
  } catch (err: any) {
    console.error('[Daily Financial Report Error]:', err);
    return { success: false, error: err.message || 'Failed to send daily financial report' };
  }
}

app.post('/api/telegram/test', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { botToken, chatId } = body;
  const testMessage = `🤖 <b>TELEGRAM NOTIFICATION TEST</b>\n\nYour Telegram bot is successfully connected to <b>CHTH Cafe Manager</b>!\n\n<i>Timestamp: ${new Date().toLocaleString()}</i>`;
  
  const result = await sendTelegramNotification(c.env, testMessage, 'sales', { botToken, chatId });
  return c.json(result);
});

app.post('/api/telegram/daily-report', async (c) => {
  const result = await sendDailyFinancialReport(c.env);
  return c.json(result);
});

// --- 7. SPA Fallback Routing for Non-API Routes (e.g. /admin, /staff) ---
app.get('*', async (c) => {
  if (c.req.path.startsWith('/api')) {
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
      ctx.waitUntil(sendDailyFinancialReport(env));
    } else {
      await sendDailyFinancialReport(env);
    }
  }
};
