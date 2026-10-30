import schema from '../../schema.sql';

// Every day 08:00–18:00 until the owner sets their hours.
const DEFAULT_HOURS = JSON.stringify(Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, { open: '08:00', close: '18:00', closed: false }])));

/** The tables and triggers from schema.sql, without its demo menu, staff and orders. */
export function baseStatements(sql = schema) {
  const statements = sql.replace(/^--.*$/gm, '').match(/CREATE TRIGGER[\s\S]*?\nEND;|CREATE TABLE[\s\S]*?;/g) || [];
  return statements.map(statement => statement.trim());
}

const ready = new WeakMap<object, Promise<void>>();
/** A brand-new database, as made by the Deploy button or the control plane, gets its tables on first use. */
export function ensureBaseSchema(db: D1Database) {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      const existing = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").first();
      if (existing) return;
      await db.batch([
        ...baseStatements().map(sql => db.prepare(sql)),
        db.prepare("INSERT OR IGNORE INTO settings (id, cafe_name, logo_url, contact_phone, address, open_hours, updated_at) VALUES ('cafe_config', 'My café', '', '', '', ?, ?)").bind(DEFAULT_HOURS, new Date().toISOString())
      ]);
    })();
    ready.set(db, pending);
    pending.catch(() => ready.delete(db));
  }
  return pending;
}
