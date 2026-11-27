-- Release 1.2 columns: menu item order, tips and pickup times on orders, suppliers on materials, waste reasons,
-- and the club and pickup-slot settings. The Worker adds these columns on its own (ensureFeatureTables in
-- src/services/operations.ts, ensureMenuColumns and ensureSettingsColumns in src/server.ts); this file is for
-- databases migrated by hand. Run it before 0009.
ALTER TABLE menu_items ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tip_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN pickup_at TEXT;
ALTER TABLE stock_items ADD COLUMN supplier_id TEXT;
ALTER TABLE inventory_movements ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN loyalty TEXT NOT NULL DEFAULT '{}';
ALTER TABLE settings ADD COLUMN pickup_slots TEXT NOT NULL DEFAULT '{}';
