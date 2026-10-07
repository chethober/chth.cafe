-- Mirrors the tail of src/services/operationsMigration.ts. Keep both in sync.
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
