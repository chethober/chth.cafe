-- Mirrors the tail of src/services/operationsMigration.ts. Keep both in sync.
-- Cancelling keeps ingredients deducted, only deleting an order returns them.
DROP TRIGGER IF EXISTS order_cancel_restore;
