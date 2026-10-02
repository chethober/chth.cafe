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
CREATE TRIGGER IF NOT EXISTS order_cancel_restore AFTER UPDATE OF status ON orders WHEN NEW.status = 'cancelled' AND OLD.status = 'pending' BEGIN
  INSERT INTO inventory_movements (id,stock_item_id,kind,quantity,notes,order_id,created_at)
  SELECT 'return-' || id, stock_item_id, 'return', -quantity, 'Cancelled before preparation', order_id, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM inventory_movements WHERE order_id = NEW.id AND kind = 'consumption';
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
`;
