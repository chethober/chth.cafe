import type { Context, Hono } from 'hono';
import type { Env } from '../server';

const COLUMNS = 'id, name, phone, notes, created_at AS createdAt, updated_at AS updatedAt';

/**
 * Phone numbers are matched by digits only, so "0912 345 6789" and "09123456789" are the same member. Persian and Arabic digits count too.
 * Iran's country code is written as the local trunk 0: "+98 912…", "+98 0912…" and "0098 912…" are all stored as "0912…".
 */
export function normalizePhone(value: unknown): string {
  const text = String(value ?? '').trim().replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
  const phone = (text.startsWith('+') ? '+' : '') + text.replace(/\D/g, '');
  return phone.replace(/^(?:\+|00)980?(?=\d)/, '0');
}

function validate(input: { name?: unknown; phone?: unknown; notes?: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = normalizePhone(input.phone);
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const digits = phone.replace('+', '').length;
  if (!name || name.length > 100) return { error: 'Enter a name up to 100 characters.' };
  if (digits < 5 || digits > 20) return { error: 'Enter a phone number with 5 to 20 digits.' };
  if (notes.length > 1000) return { error: 'Notes can be up to 1,000 characters.' };
  return { name, phone, notes };
}

async function phoneTaken(c: Context<Env>, phone: string, exceptId = '') {
  const row = await c.env.DB.prepare('SELECT name FROM customers WHERE phone = ? AND id != ?').bind(phone, exceptId).first<{ name: string }>();
  return row ? c.json({ success: false, message: `${row.name} is already a member with this phone number.` }, 409) : null;
}

export function registerCustomers(app: Hono<Env>) {
  app.get('/api/customers', async c => {
    const { results } = await c.env.DB.prepare(`SELECT ${COLUMNS} FROM customers ORDER BY name COLLATE NOCASE`).all();
    return c.json({ data: results });
  });

  app.post('/api/customers', async c => {
    const body = await c.req.json();
    const fields = validate(body);
    if ('error' in fields) return c.json({ success: false, message: fields.error }, 400);
    if (body.id !== undefined && (typeof body.id !== 'string' || !/^cus-[0-9a-f-]{36}$/i.test(body.id))) return c.json({ success: false, message: 'Invalid member ID.' }, 400);
    const taken = await phoneTaken(c, fields.phone); if (taken) return taken;
    const now = new Date().toISOString();
    const customer = { id: body.id || `cus-${crypto.randomUUID()}`, ...fields, createdAt: now, updatedAt: now };
    try {
      await c.env.DB.prepare('INSERT INTO customers (id, name, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(customer.id, customer.name, customer.phone, customer.notes, now, now).run();
    } catch (error) {
      // A concurrent sign-up with the same phone, or a retry of this one, lost the race to the unique index.
      if (String(error).includes('UNIQUE')) return await phoneTaken(c, fields.phone) || c.json({ success: false, message: 'This member already exists.' }, 409);
      throw error;
    }
    return c.json({ success: true, data: customer });
  });

  app.put('/api/customers/:id', async c => {
    const id = c.req.param('id');
    const current = await c.env.DB.prepare(`SELECT ${COLUMNS} FROM customers WHERE id = ?`).bind(id).first<Record<string, string>>();
    if (!current) return c.json({ success: false, message: 'Member not found.' }, 404);
    const body = await c.req.json();
    const fields = validate({ name: body.name ?? current.name, phone: body.phone ?? current.phone, notes: body.notes ?? current.notes });
    if ('error' in fields) return c.json({ success: false, message: fields.error }, 400);
    const taken = await phoneTaken(c, fields.phone, id); if (taken) return taken;
    const updatedAt = new Date().toISOString();
    await c.env.DB.prepare('UPDATE customers SET name = ?, phone = ?, notes = ?, updated_at = ? WHERE id = ?').bind(fields.name, fields.phone, fields.notes, updatedAt, id).run();
    return c.json({ success: true, data: { ...current, ...fields, updatedAt } });
  });

  // Orders keep the name they were placed under; only the link to the member goes.
  app.delete('/api/customers/:id', async c => {
    const id = c.req.param('id');
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id)
    ]);
    return c.json({ success: true });
  });
}
