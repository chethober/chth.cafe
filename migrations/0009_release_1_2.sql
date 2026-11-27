-- Mirrors the tail of src/services/operationsMigration.ts. Keep both in sync. Release 1.2: promotions, club stamps and points, option recipes, suppliers and purchase orders.
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'percent' CHECK(kind IN ('percent','fixed')),
  value REAL NOT NULL CHECK(value > 0),
  category_ids TEXT NOT NULL DEFAULT '[]',
  item_ids TEXT NOT NULL DEFAULT '[]',
  days TEXT NOT NULL DEFAULT '[]',
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  starts_on TEXT NOT NULL DEFAULT '',
  ends_on TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customer_ledger (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('earn','redeem','adjust')),
  stamps INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_customer ON customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON customer_ledger(order_id);
CREATE TABLE IF NOT EXISTS variant_recipes (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  stock_item_id TEXT NOT NULL,
  quantity_delta REAL NOT NULL CHECK(quantity_delta != 0)
);
CREATE INDEX IF NOT EXISTS idx_variant_recipes_variant ON variant_recipes(variant_id);
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  telegram TEXT NOT NULL DEFAULT '',
  lead_time_days INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  supplier_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','received','cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  expected_on TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  received_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  stock_item_id TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_cost REAL NOT NULL DEFAULT 0,
  received_quantity REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_order ON purchase_order_lines(purchase_order_id);
