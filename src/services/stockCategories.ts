import type { Hono } from 'hono';
import type { Env } from '../server';
import { DEFAULT_STOCK_CATEGORIES, MAX_STOCK_CATEGORY_LENGTH, cleanStockCategories, parseStockCategories } from '../utils/stockCategories';

/**
 * Material categories are a list the admin keeps in settings. Materials store the category name,
 * so renaming one moves its materials along, and a category still holding materials cannot be removed.
 */
export function registerStockCategories(app: Hono<Env>) {
  const savedList = async (db: D1Database) => {
    const row = await db.prepare('SELECT stock_categories FROM settings WHERE id = ?').bind('cafe_config').first<{ stock_categories: string | null }>();
    return parseStockCategories(row?.stock_categories) ?? DEFAULT_STOCK_CATEGORIES;
  };
  const invalidName = (name: string) => name.length > MAX_STOCK_CATEGORY_LENGTH ? `Keep category names to ${MAX_STOCK_CATEGORY_LENGTH} characters.` : '';

  app.put('/api/stock-categories', async c => {
    const body = await c.req.json();
    if (!Array.isArray(body.categories) || body.categories.length > 100) return c.json({ success: false, message: 'Send a list of up to 100 categories.' }, 400);
    const categories = cleanStockCategories(body.categories);
    const tooLong = categories.map(invalidName).find(Boolean);
    if (tooLong) return c.json({ success: false, message: tooLong }, 400);
    const { results } = await c.env.DB.prepare('SELECT DISTINCT category FROM stock_items').all<{ category: string }>();
    const orphaned = results.find(row => !categories.includes(row.category));
    if (orphaned) return c.json({ success: false, message: `“${orphaned.category}” still has materials. Move them to another category, or rename it instead.` }, 409);
    await c.env.DB.prepare('UPDATE settings SET stock_categories = ? WHERE id = ?').bind(JSON.stringify(categories), 'cafe_config').run();
    return c.json({ success: true, data: categories });
  });

  // Renaming onto an existing category merges the two.
  app.post('/api/stock-categories/rename', async c => {
    const body = await c.req.json();
    const from = typeof body.from === 'string' ? body.from : '';
    const [to] = cleanStockCategories([body.to]);
    if (!from || !to) return c.json({ success: false, message: 'Give the category a name.' }, 400);
    const tooLong = invalidName(to);
    if (tooLong) return c.json({ success: false, message: tooLong }, 400);
    const current = await savedList(c.env.DB);
    const existing = current.find(name => name.toLowerCase() === to.toLowerCase() && name !== from);
    const target = existing || to;
    // A merge keeps the existing category where it is; a plain rename keeps the old name's place.
    const categories = cleanStockCategories(existing ? current.filter(name => name !== from)
      : current.includes(from) ? current.map(name => name === from ? target : name) : [...current, target]);
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE stock_items SET category = ? WHERE category = ?').bind(target, from),
      c.env.DB.prepare('UPDATE settings SET stock_categories = ? WHERE id = ?').bind(JSON.stringify(categories), 'cafe_config')
    ]);
    return c.json({ success: true, data: { categories, name: target } });
  });
}
