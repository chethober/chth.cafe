// Worker-compatible copy of migrations/0002_operations.sql. Keep both in sync.
export default `CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  stock_item_id TEXT NOT NULL REFERENCES stock_items(id),
  kind TEXT NOT NULL CHECK(kind IN ('purchase','consumption','waste','adjustment','return')),
  quantity REAL NOT NULL CHECK(quantity != 0),
  notes TEXT NOT NULL DEFAULT '',
  order_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reconciliations (
  date TEXT PRIMARY KEY,
  opening_cash REAL NOT NULL,
  expected_cash REAL NOT NULL,
  expected_card REAL NOT NULL,
  actual_cash REAL NOT NULL,
  actual_card REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS movement_validate BEFORE INSERT ON inventory_movements BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM stock_items WHERE id = NEW.stock_item_id) THEN RAISE(ABORT, 'Stock item missing') END;
  SELECT CASE WHEN (SELECT quantity FROM stock_items WHERE id = NEW.stock_item_id) + NEW.quantity < -0.000001 THEN RAISE(ABORT, 'Insufficient stock') END;
END;
CREATE TRIGGER IF NOT EXISTS movement_apply AFTER INSERT ON inventory_movements BEGIN
  UPDATE stock_items SET quantity = MAX(0, quantity + NEW.quantity), total_price = MAX(0, quantity + NEW.quantity) * unit_cost, updated_at = NEW.created_at WHERE id = NEW.stock_item_id;
END;
CREATE TRIGGER IF NOT EXISTS order_status_validate BEFORE UPDATE OF status ON orders WHEN NEW.status != OLD.status BEGIN
  SELECT CASE WHEN NOT (
    (OLD.status = 'pending' AND NEW.status IN ('preparing','cancelled')) OR
    (OLD.status = 'preparing' AND NEW.status IN ('ready','cancelled')) OR
    (OLD.status = 'ready' AND NEW.status IN ('completed','cancelled'))
  ) THEN RAISE(ABORT, 'Invalid order status transition') END;
END;

CREATE TABLE IF NOT EXISTS order_requests (
  id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
-- Cancelling keeps ingredients deducted, only deleting an order returns them.
DROP TRIGGER IF EXISTS order_cancel_restore;
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
`;
