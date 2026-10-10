-- Cloudflare D1 Initial Migration & Seed SQL Schema for CHTH Cafe
-- Created from backup.sql database snapshot

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  cafe_name TEXT NOT NULL DEFAULT 'CHTH',
  logo_url TEXT DEFAULT '',
  brand_primary TEXT NOT NULL DEFAULT '#059669',
  brand_secondary TEXT NOT NULL DEFAULT '#064e3b',
  appearance TEXT NOT NULL DEFAULT '{}',
  time_zone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  currency TEXT NOT NULL DEFAULT '₹',
  tax_rate REAL NOT NULL DEFAULT 8.5,
  open_hours TEXT NOT NULL,
  contact_phone TEXT DEFAULT '+1 (555) 382-9104',
  address TEXT DEFAULT '108 CHTH Way, Botanical District',
  telegram_bot_token TEXT DEFAULT '',
  telegram_chat_id TEXT DEFAULT '',
  notify_sales INTEGER NOT NULL DEFAULT 1,
  notify_shifts INTEGER NOT NULL DEFAULT 1,
  notify_tasks INTEGER NOT NULL DEFAULT 1,
  notify_daily_report INTEGER NOT NULL DEFAULT 1,
  notify_low_stock INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Tea & Coffee',
  quantity REAL NOT NULL DEFAULT 0.0,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_cost REAL NOT NULL DEFAULT 0.0,
  total_price REAL NOT NULL DEFAULT 0.0,
  min_threshold REAL NOT NULL DEFAULT 5.0,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  quantity_required REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT DEFAULT 'Coffee'
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  base_price REAL NOT NULL,
  profit_margin REAL NOT NULL DEFAULT 0.0,
  is_in_stock INTEGER NOT NULL DEFAULT 1,
  image_url TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  allergens TEXT NOT NULL DEFAULT '',
  dietary_labels TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_variants (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  name TEXT NOT NULL,
  price_modifier REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Barista',
  pin TEXT NOT NULL,
  hourly_rate REAL NOT NULL DEFAULT 18.50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  total_hours REAL DEFAULT 0.0,
  total_pay REAL DEFAULT 0.0,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  customer_name TEXT DEFAULT 'Walk-in Customer',
  order_type TEXT NOT NULL DEFAULT 'dine_in',
  subtotal REAL NOT NULL,
  tax_amount REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'card',
  status TEXT NOT NULL DEFAULT 'completed',
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  variants_json TEXT DEFAULT '[]',
  item_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  logged_by_staff_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Opening',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  due_date TEXT DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

-- =========================================================================
-- SEED DATA MIGRATED FROM BACKUP.SQL
-- =========================================================================

-- Settings
INSERT OR IGNORE INTO settings (id, cafe_name, logo_url, brand_primary, brand_secondary, currency, tax_rate, open_hours, contact_phone, address, updated_at)
VALUES ('cafe_config', 'CHTH', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80', '#059669', '#064e3b', '₹', 8.5, '{"Monday":{"open":"07:00","close":"19:00","closed":false},"Tuesday":{"open":"07:00","close":"19:00","closed":false},"Wednesday":{"open":"07:00","close":"19:00","closed":false},"Thursday":{"open":"07:00","close":"19:00","closed":false},"Friday":{"open":"07:00","close":"21:00","closed":false},"Saturday":{"open":"08:00","close":"21:00","closed":false},"Sunday":{"open":"08:00","close":"18:00","closed":false}}', '+1 (555) 382-9104', '108 CHTH Way, Botanical District', '2026-07-24T00:00:00.000Z');

-- Categories
INSERT OR IGNORE INTO categories (id, name, display_order, icon) VALUES
('cat-matcha', 'Artisan Teas & Matcha', 1, 'Leaf'),
('cat-espresso', 'Espresso & Hot Brews', 2, 'Coffee'),
('cat-iced', 'Iced Elixirs & Cold Brews', 3, 'GlassWater'),
('cat-bakery', 'Fresh Bakery & Pastries', 4, 'Cake'),
('cat-brunch', 'Brunch & Artisanal Toast', 5, 'Utensils');

-- Menu Items
INSERT OR IGNORE INTO menu_items (id, category_id, name, description, base_price, profit_margin, is_in_stock, image_url, badge, created_at) VALUES
('item-iced-matcha', 'cat-matcha', 'Kyoto Cloud Matcha Latte', 'First-harvest ceremonial Grade A Uji matcha whisked fresh with oat milk & vanilla cold foam.', 280.00, 201.40, 1, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', 'Signature', '2026-07-01T08:00:00.000Z'),
('item-jasmine-dragon', 'cat-matcha', 'Jasmine Dragon Pearl Infusion', 'Hand-rolled green tea pearls scented with night-blooming jasmine flowers.', 150.00, 100.00, 1, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', 'Organic', '2026-07-01T08:00:00.000Z'),
('item-honey-latte', 'cat-espresso', 'Honey Lavender Latte', 'Double shot espresso, wild honey, organic lavender infusion, steamed whole milk.', 250.00, 180.00, 1, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80', 'Popular', '2026-07-01T08:00:00.000Z'),
('item-salted-coldbrew', 'cat-iced', 'Salted Caramel Cold Brew', '18-hour slow steeped cold brew topped with house-made salted caramel cold foam.', 280.00, 200.00, 1, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', 'Bestseller', '2026-07-01T08:00:00.000Z'),
('item-almond-croissant', 'cat-bakery', 'Toasted Almond Croissant', 'Flaky butter croissant filled with almond frangipane and topped with sliced toasted almonds.', 180.00, 120.00, 1, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', 'Fresh Baked', '2026-07-01T08:00:00.000Z'),
('item-avocado-toast', 'cat-brunch', 'Truffle Avocado & Poached Egg Toast', 'Smashed Haas avocado, organic poached egg, pickled red onion, microgreens on sourdough.', 290.00, 180.00, 1, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80', 'Chef Special', '2026-07-01T08:00:00.000Z'),
('item-espresso', 'cat-espresso', 'Espresso', 'Classic double shot artisanal espresso.', 120.00, 100.20, 1, 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80', 'Classic', '2026-07-01T08:00:00.000Z'),
('item-americano', 'cat-espresso', 'Americano', 'Double espresso diluted with hot filtered water.', 140.00, 120.20, 1, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-cortado', 'cat-espresso', 'Cortado', 'Equal parts espresso and warm silky milk.', 160.00, 135.40, 1, 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-cappuccino', 'cat-espresso', 'Cappuccino', 'Espresso with rich velvety steamed milk foam.', 210.00, 174.20, 1, 'https://images.unsplash.com/photo-1572442388796-11668ba67e53?auto=format&fit=crop&w=600&q=80', 'Popular', '2026-07-01T08:00:00.000Z'),
('item-latte', 'cat-espresso', 'Latte', 'Smooth espresso with micro-foamed milk.', 210.00, 174.20, 1, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-matcha-latte', 'cat-matcha', 'Matcha Latte', 'First-harvest Uji matcha whisked with milk.', 280.00, 201.40, 1, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', 'Signature', '2026-07-01T08:00:00.000Z'),
('item-spanish-latte', 'cat-espresso', 'Spanish Latte', 'Espresso combined with sweetened condensed milk.', 250.00, 205.69, 1, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', 'Bestseller', '2026-07-01T08:00:00.000Z'),
('item-vietnamese', 'cat-espresso', 'Vietnamese Coffee', 'Dark roast drip coffee with condensed milk.', 280.00, 242.09, 1, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-mocha', 'cat-espresso', 'Mocha', 'Espresso infused with dark chocolate & steamed milk.', 250.00, 191.45, 1, 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-hot-chocolate', 'cat-iced', 'Hot Chocolate', 'Rich dark chocolate melted into warm creamy milk.', 280.00, 216.75, 1, 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-frappe', 'cat-iced', 'Frappe', 'Blended iced coffee elixir with velvety foam.', 310.00, 222.34, 1, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', 'Popular', '2026-07-01T08:00:00.000Z'),
('item-irani-tea', 'cat-matcha', 'Irani Tea', 'Classic dum brewed sweet chai.', 100.00, 96.20, 1, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-masala-tea', 'cat-matcha', 'Masala Tea', 'Aromatic tea infused with cardamom, ginger & spices.', 100.00, 91.20, 1, 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80', 'Bestseller', '2026-07-01T08:00:00.000Z'),
('item-green-tea', 'cat-matcha', 'Green Tea', 'Pure whole leaf green tea brew.', 150.00, 150.00, 1, 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80', 'Organic', '2026-07-01T08:00:00.000Z'),
('item-hibiscus-tea', 'cat-matcha', 'Hibiscus Tea', 'Tart & floral ruby red herbal tea.', 150.00, 147.92, 1, 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-chamomile-tea', 'cat-matcha', 'Chamomile Tea', 'Soothing Egyptian chamomile blossom tea.', 150.00, 150.00, 1, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-purple-peace', 'cat-matcha', 'Purple Peace', 'Butterfly pea flower & lavender soothing tea.', 210.00, 210.00, 1, 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80', 'Specialty', '2026-07-01T08:00:00.000Z'),
('item-persian-snap', 'cat-iced', 'Persian Snap', 'Saffron & rose infused cold refreshment.', 250.00, 250.00, 1, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', 'Signature', '2026-07-01T08:00:00.000Z'),
('item-brain-freeze', 'cat-iced', 'Brain Freeze', 'Intense double espresso slush over crushed ice.', 280.00, 260.20, 1, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-creamy-mushroom-sandwich', 'cat-brunch', 'Creamy Mushroom (Sandwich)', 'Sautéed mushrooms, garlic cream cheese on sourdough.', 290.00, 192.91, 1, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', 'Chef Special', '2026-07-01T08:00:00.000Z'),
('item-tandoori-paneer-sandwich', 'cat-brunch', 'Tandoori Paneer (Sandwich)', 'Spiced tandoori paneer cubes & crisp lettuce toastie.', 310.00, 249.61, 1, 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?auto=format&fit=crop&w=600&q=80', 'Popular', '2026-07-01T08:00:00.000Z'),
('item-dead-by-cheese-sandwich', 'cat-brunch', 'Dead By Cheese (Sandwich)', 'Triple cheese blend grilled sourdough sandwich.', 320.00, 320.00, 1, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', 'Bestseller', '2026-07-01T08:00:00.000Z'),
('item-creamy-mushroom-pasta', 'cat-brunch', 'Creamy Mushroom (Pasta)', 'Penne pasta in rich garlic & mushroom white sauce.', 280.00, 152.43, 1, 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-tandoori-paneer-pasta', 'cat-brunch', 'Tandoori Paneer (Pasta)', 'Penne pasta tossed in spicy tandoori paneer sauce.', 290.00, 185.65, 1, 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?auto=format&fit=crop&w=600&q=80', '', '2026-07-01T08:00:00.000Z'),
('item-dead-by-cheese-pasta', 'cat-brunch', 'Dead By Cheese (Pasta)', 'Macaroni & penne in rich four-cheese sauce bake.', 310.00, 236.43, 1, 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=600&q=80', 'Popular', '2026-07-01T08:00:00.000Z'),
('item-messy-platter', 'cat-brunch', 'Messy Platter', 'Assorted messy dips, sourdough crisps & loaded sides.', 200.00, 170.75, 1, 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80', 'Sharing', '2026-07-01T08:00:00.000Z');

-- Menu Variants
INSERT OR IGNORE INTO menu_variants (id, menu_item_id, group_name, name, price_modifier) VALUES
('var-mc-oat', 'item-iced-matcha', 'Milk Choice', 'Oat Milk', 0.0),
('var-mc-coco', 'item-iced-matcha', 'Milk Choice', 'Coconut Milk', 0.50),
('var-sz-reg', 'item-honey-latte', 'Size', 'Regular (12oz)', 0.0),
('var-sz-lrg', 'item-honey-latte', 'Size', 'Large (16oz)', 0.85),
('var-mlk-whl', 'item-honey-latte', 'Milk Choice', 'Whole Milk', 0.0),
('var-mlk-oat', 'item-honey-latte', 'Milk Choice', 'Oat Milk', 0.75);

-- Staff (Migrated from backup.sql employees)
INSERT OR IGNORE INTO staff (id, name, role, pin, hourly_rate, status, created_at) VALUES
('staff-hasti', 'Hasti', 'Manager', lower(hex(randomblob(16))), 25.00, 'active', '2026-06-17T15:00:00.000Z'),
('staff-rakshanda', 'Rakshanda', 'Head Barista', lower(hex(randomblob(16))), 20.00, 'active', '2026-06-18T06:00:00.000Z'),
('staff-rehan', 'Rehan', 'Barista', lower(hex(randomblob(16))), 18.50, 'active', '2026-06-18T14:00:00.000Z'),
('staff-nilesh', 'Nilesh', 'Barista', lower(hex(randomblob(16))), 18.50, 'active', '2026-06-20T12:00:00.000Z'),
('staff-omid', 'omid', 'Barista', lower(hex(randomblob(16))), 18.50, 'active', '2026-06-30T16:00:00.000Z');

-- Actual Tasks (Migrated from tasks & cleaning_tasks in backup.sql)
INSERT OR IGNORE INTO tasks (id, title, description, category, priority, status, assigned_staff_id, due_date, completed_at, created_at) VALUES
('task-sql-2', 'Refill Syrups', 'Replenish vanilla, caramel, and lavender syrup bottles on front bar station.', 'Opening', 'medium', 'completed', 'staff-nilesh', '2026-07-24', '2026-07-24T05:31:07.000Z', '2026-07-24T04:40:00.000Z'),
('task-sql-3', 'Check Ingredient Stock', 'Verify matcha powder, espresso beans, oat milk, and whole milk stock levels.', 'Inventory', 'high', 'completed', 'staff-nilesh', '2026-07-24', '2026-07-24T05:31:25.000Z', '2026-07-24T04:40:00.000Z'),
('task-sql-4', 'Refill Ice', 'Fill ice bins for cold brew & iced matcha stations.', 'Opening', 'high', 'completed', 'staff-nilesh', '2026-07-24', '2026-07-24T05:31:43.000Z', '2026-07-24T04:40:00.000Z'),
('task-sql-5', 'Refill Tea & Masala', 'Stock loose leaf teas, jasmine pearls, and masala spices.', 'Opening', 'medium', 'completed', 'staff-nilesh', '2026-07-24', '2026-07-24T05:31:32.000Z', '2026-07-24T04:40:00.000Z'),
('task-sql-12', 'Turn On Water Pump', 'Engage water filtration pump for espresso machine boiler line.', 'Opening', 'high', 'completed', 'staff-nilesh', '2026-07-24', '2026-07-24T05:31:15.000Z', '2026-07-24T04:40:00.000Z'),
('task-sql-6', 'Clean Tea Pot & Steaming Wands', 'Rinse ceremonial tea pots and sanitize steam wands with solution.', 'Cleaning', 'high', 'in_progress', 'staff-rakshanda', '2026-07-24', NULL, '2026-07-24T12:00:00.000Z'),
('task-sql-7', 'Clean & Organize Refrigerator', 'Weekly cleaning routine: sanitize milk fridge racks and wipe spills.', 'Cleaning', 'medium', 'in_progress', 'staff-rehan', '2026-07-24', NULL, '2026-07-24T12:00:00.000Z'),
('task-sql-8', 'Turn Off Coffee Machine & Secure Bar', 'Purge espresso group heads, backflush with puly caff, and turn off boilers.', 'Closing', 'high', 'pending', 'staff-hasti', '2026-07-24', NULL, '2026-07-24T12:00:00.000Z'),
('task-sql-9', 'Update Order Board & POS Reconciliation', 'Audit register cash drawer, balance daily receipts, and lock POS.', 'Closing', 'high', 'pending', 'staff-hasti', '2026-07-24', NULL, '2026-07-24T12:00:00.000Z');

-- Initial Shifts (Migrated from logs in backup.sql)
INSERT OR IGNORE INTO shifts (id, staff_id, clock_in, clock_out, total_hours, total_pay, notes, created_at) VALUES
('shift-140', 'staff-nilesh', '2026-07-24T04:40:18.000Z', NULL, 4.5, 83.25, 'Active shift on floor', '2026-07-24T04:40:18.000Z'),
('shift-139', 'staff-nilesh', '2026-07-24T04:40:18.000Z', '2026-07-24T13:40:00.000Z', 9.0, 166.50, 'Shift completed', '2026-07-24T04:40:18.000Z'),
('shift-138', 'staff-rehan', '2026-07-22T14:48:15.000Z', '2026-07-23T13:47:27.000Z', 22.9, 423.65, 'Overnight & day shift log', '2026-07-22T14:48:15.000Z'),
('shift-135', 'staff-nilesh', '2026-07-22T04:40:49.000Z', '2026-07-23T13:47:38.000Z', 33.1, 612.35, 'Daily manager shift log', '2026-07-22T04:40:49.000Z'),
('shift-130', 'staff-rehan', '2026-07-20T15:08:29.000Z', '2026-07-21T13:54:45.000Z', 22.7, 419.95, 'Full operational shift', '2026-07-20T15:08:29.000Z'),
('shift-129', 'staff-rakshanda', '2026-07-20T06:35:36.000Z', '2026-07-20T15:08:00.000Z', 8.5, 170.00, 'Morning shift opening', '2026-07-20T06:35:36.000Z'),
('shift-120', 'staff-rakshanda', '2026-07-17T13:33:15.000Z', '2026-07-17T18:13:06.000Z', 4.7, 94.00, 'Afternoon tea bar shift', '2026-07-17T13:33:15.000Z'),
('shift-108', 'staff-rakshanda', '2026-07-10T08:54:51.000Z', '2026-07-10T15:18:33.000Z', 6.4, 128.00, 'Barista shift', '2026-07-10T08:54:51.000Z'),
('shift-107', 'staff-nilesh', '2026-07-10T04:53:50.000Z', '2026-07-10T13:44:29.000Z', 8.8, 162.80, 'Opening store shift', '2026-07-10T04:53:50.000Z'),
('shift-9', 'staff-hasti', '2026-06-19T05:06:49.000Z', '2026-06-19T18:09:39.000Z', 13.0, 325.00, 'Full day store management', '2026-06-19T05:06:49.000Z');

-- Initial Orders & Order Items
INSERT OR IGNORE INTO orders (id, order_number, customer_name, order_type, subtotal, tax_amount, discount_amount, total_amount, payment_method, status, createdAt) VALUES
('ord-1001', '#1001', 'Sarah Jenkins', 'takeout', 16.95, 1.44, 0.0, 18.39, 'card', 'completed', '2026-07-24T10:15:00.000Z'),
('ord-1002', '#1002', 'Darius Vance', 'dine_in', 24.75, 2.10, 0.0, 26.85, 'google_pay', 'preparing', '2026-07-24T11:05:00.000Z'),
('ord-1003', '#1003', 'Swiggy / Zomato Express', 'pickup', 12.25, 1.04, 0.0, 13.29, 'online', 'pending', '2026-07-24T11:22:00.000Z');

INSERT OR IGNORE INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, variants_json, item_total) VALUES
('item-ord-1', 'ord-1001', 'item-iced-matcha', 'Kyoto Cloud Matcha Latte', 2, 6.75, '["Oat Milk"]', 13.50),
('item-ord-2', 'ord-1002', 'item-avocado-toast', 'Truffle Avocado & Poached Egg Toast', 2, 12.50, '[]', 25.00);

-- Initial Expenses
INSERT OR IGNORE INTO expenses (id, category, description, amount, date, payment_method, logged_by_staff_id, created_at) VALUES
('exp-1', 'Tea & Coffee Supplies', 'Grade A Ceremonial Uji Matcha (10kg) & Single-Origin Espresso Beans', 480.00, '2026-07-23', 'card', 'staff-hasti', '2026-07-23T14:00:00.000Z');

-- Initial Stock Items
INSERT OR IGNORE INTO stock_items (id, name, category, quantity, unit, unit_cost, total_price, min_threshold, updated_at, created_at) VALUES
('stock-1', 'Ceremonial Uji Matcha Powder', 'Tea & Coffee', 4.5, 'kg', 3200.00, 14400.00, 5.0, '2026-07-24T00:00:00.000Z', '2026-07-01T00:00:00.000Z'),
('stock-2', 'Single-Origin Espresso Beans', 'Tea & Coffee', 18.0, 'kg', 1400.00, 25200.00, 10.0, '2026-07-24T00:00:00.000Z', '2026-07-01T00:00:00.000Z'),
('stock-3', 'Organic Oat Milk', 'Dairy & Milk', 35.0, 'liters', 180.00, 6300.00, 15.0, '2026-07-24T00:00:00.000Z', '2026-07-01T00:00:00.000Z'),
('stock-4', 'Wild Mountain Honey', 'Syrups & Flavors', 8.0, 'kg', 650.00, 5200.00, 3.0, '2026-07-24T00:00:00.000Z', '2026-07-01T00:00:00.000Z'),
('stock-5', 'Vanilla Bean Cold Foam Syrup', 'Syrups & Flavors', 2.5, 'liters', 450.00, 1125.00, 4.0, '2026-07-24T00:00:00.000Z', '2026-07-01T00:00:00.000Z'),
('stock-6', 'Artisanal Sourdough Bread Loaves', 'Bakery & Flour', 12.0, 'units', 120.00, 1440.00, 5.0, '2026-07-24T00:00:00.000Z', '2026-07-01T00:00:00.000Z'),
('stock-7', 'Organic Hass Avocados', 'Produce', 25.0, 'units', 45.00, 1125.00, 8.0, '2026-07-24T00:00:00.000Z', '2026-07-01T00:00:00.000Z');

-- Initial Recipes
INSERT OR IGNORE INTO recipes (id, menu_item_id, stock_item_id, quantity_required) VALUES
('rcp-1', 'item-iced-matcha', 'stock-1', 0.015),
('rcp-2', 'item-iced-matcha', 'stock-3', 0.250),
('rcp-3', 'item-iced-matcha', 'stock-5', 0.030),
('rcp-4', 'item-honey-latte', 'stock-2', 0.018),
('rcp-5', 'item-honey-latte', 'stock-4', 0.020),
('rcp-6', 'item-avocado-toast', 'stock-6', 1.0),
('rcp-7', 'item-avocado-toast', 'stock-7', 0.5);

CREATE TABLE IF NOT EXISTS inventory_movements (
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
