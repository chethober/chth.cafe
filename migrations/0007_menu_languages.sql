-- Menu names in other languages, and staff-only categories. The Worker adds these columns on its own
-- (ensureMenuColumns in src/server.ts); this file is for databases migrated by hand.
ALTER TABLE categories ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';
ALTER TABLE menu_items ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';
