import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// 1. Branding & Cafe Customization Settings
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(), // e.g. 'cafe_config'
  cafeName: text('cafe_name').notNull().default('CHTH'),
  logoUrl: text('logo_url').default(''),
  brandPrimary: text('brand_primary').notNull().default('#059669'), // Tea Emerald Green
  brandSecondary: text('brand_secondary').notNull().default('#064e3b'), // Deep Forest
  currency: text('currency').notNull().default('$'),
  taxRate: real('tax_rate').notNull().default(8.5), // Percentage (8.5%)
  openHours: text('open_hours').notNull().default(JSON.stringify({
    Monday: { open: '07:00', close: '19:00', closed: false },
    Tuesday: { open: '07:00', close: '19:00', closed: false },
    Wednesday: { open: '07:00', close: '19:00', closed: false },
    Thursday: { open: '07:00', close: '19:00', closed: false },
    Friday: { open: '07:00', close: '21:00', closed: false },
    Saturday: { open: '08:00', close: '21:00', closed: false },
    Sunday: { open: '08:00', close: '18:00', closed: false }
  })),
  contactPhone: text('contact_phone').default('+1 (555) 382-9104'),
  address: text('address').default('123 Cafe Street, Downtown'),
  telegramBotToken: text('telegram_bot_token').default(''),
  telegramChatId: text('telegram_chat_id').default(''),
  notifySales: integer('notify_sales', { mode: 'boolean' }).notNull().default(true),
  notifyShifts: integer('notify_shifts', { mode: 'boolean' }).notNull().default(true),
  notifyTasks: integer('notify_tasks', { mode: 'boolean' }).notNull().default(true),
  notifyDailyReport: integer('notify_daily_report', { mode: 'boolean' }).notNull().default(true),
  notifyLowStock: integer('notify_low_stock', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull()
});

// 2. Menu Categories
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  icon: text('icon').default('Coffee')
});

// 3. Menu Items
export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').default(''),
  basePrice: real('base_price').notNull(),
  profitMargin: real('profit_margin').notNull().default(0.0),
  isInStock: integer('is_in_stock', { mode: 'boolean' }).notNull().default(true),
  imageUrl: text('image_url').default(''),
  badge: text('badge').default(''), // e.g. "Popular", "New", "Organic"
  createdAt: text('created_at').notNull()
});

// 4. Menu Variants (Sizes, Milk choices, Syrups, Extras)
export const menuVariants = sqliteTable('menu_variants', {
  id: text('id').primaryKey(),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  groupName: text('group_name').notNull(), // 'Size', 'Milk Choice', 'Extra Option'
  name: text('name').notNull(), // e.g. 'Large (+16oz)', 'Oat Milk', 'Extra Shot'
  priceModifier: real('price_modifier').notNull().default(0.0)
});

// 5. Staff Directory
export const staff = sqliteTable('staff', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull().default('Barista'), // 'Barista', 'Head Barista', 'Manager', 'Kitchen'
  pin: text('pin').notNull(), // 4-digit PIN e.g. "1234"
  hourlyRate: real('hourly_rate').notNull().default(18.50),
  status: text('status').notNull().default('active'), // 'active', 'inactive'
  createdAt: text('created_at').notNull()
});

// 6. Employee Shifts (Time Tracker)
export const shifts = sqliteTable('shifts', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  clockIn: text('clock_in').notNull(), // ISO timestamp
  clockOut: text('clock_out'), // ISO timestamp (null if currently clocked in)
  totalHours: real('total_hours').default(0.0),
  totalPay: real('total_pay').default(0.0),
  notes: text('notes').default(''),
  createdAt: text('created_at').notNull()
});

// 7. Customer Orders & POS Sales
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(), // e.g. "#1001"
  customerName: text('customer_name').default('Walk-in Customer'),
  orderType: text('order_type').notNull().default('dine_in'), // 'dine_in', 'takeout', 'pickup'
  subtotal: real('subtotal').notNull(),
  taxAmount: real('tax_amount').notNull(),
  discountAmount: real('discount_amount').notNull().default(0.0),
  totalAmount: real('total_amount').notNull(),
  paymentMethod: text('payment_method').notNull().default('card'), // 'cash', 'card', 'qr_pay'
  status: text('status').notNull().default('completed'), // 'completed', 'pending', 'cancelled'
  createdAt: text('created_at').notNull()
});

// 8. Order Line Items
export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: text('menu_item_id').notNull(),
  itemName: text('item_name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: real('unit_price').notNull(),
  variantsJson: text('variants_json').default('[]'), // Stringified JSON array of selected variants
  itemTotal: real('item_total').notNull()
});

// 9. Manual Expenses & Cash Outflow
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // 'Tea & Coffee Supplies', 'Packaging & Cups', 'Utilities & Power', 'Equipment & Repairs', 'Rent & Lease', 'Labor Wages', 'Marketing & Other'
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  paymentMethod: text('payment_method').notNull().default('bank_transfer'), // 'cash', 'card', 'bank_transfer'
  loggedByStaffId: text('logged_by_staff_id'),
  createdAt: text('created_at').notNull()
});

// 10. Admin Tasks & Cafe Daily Checklists
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').default(''),
  category: text('category').notNull().default('Opening'), // 'Opening', 'Closing', 'Inventory', 'Cleaning', 'Maintenance'
  priority: text('priority').notNull().default('medium'), // 'high', 'medium', 'low'
  status: text('status').notNull().default('pending'), // 'pending', 'in_progress', 'completed'
  assignedStaffId: text('assigned_staff_id').references(() => staff.id, { onDelete: 'set null' }),
  dueDate: text('due_date').default(''),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull()
});

// 11. Raw Material Stock Management & Inventory
export const stockItems = sqliteTable('stock_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Tea & Coffee'), // 'Tea & Coffee', 'Dairy & Milk', 'Syrups & Flavors', 'Bakery & Flour', 'Produce', 'Packaging', 'Other'
  quantity: real('quantity').notNull().default(0.0),
  unit: text('unit').notNull().default('kg'), // 'kg', 'g', 'liters', 'ml', 'units', 'bags', 'packs'
  unitCost: real('unit_cost').notNull().default(0.0), // Cost per unit
  totalPrice: real('total_price').notNull().default(0.0), // Total valuation (quantity * unitCost)
  minThreshold: real('min_threshold').notNull().default(5.0), // Minimum stock level alert trigger
  updatedAt: text('updated_at').notNull(),
  createdAt: text('created_at').notNull()
});

// 12. Menu Item Recipes (Raw material requirements per dish/drink)
export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  stockItemId: text('stock_item_id').notNull().references(() => stockItems.id, { onDelete: 'cascade' }),
  quantityRequired: real('quantity_required').notNull().default(0.0) // Raw material consumed per portion
});

// Types exported for frontend & backend consumption
export type SettingsSelect = typeof settings.$inferSelect;
export type CategorySelect = typeof categories.$inferSelect;
export type MenuItemSelect = typeof menuItems.$inferSelect;
export type MenuVariantSelect = typeof menuVariants.$inferSelect;
export type StaffSelect = typeof staff.$inferSelect;
export type ShiftSelect = typeof shifts.$inferSelect;
export type OrderSelect = typeof orders.$inferSelect;
export type OrderItemSelect = typeof orderItems.$inferSelect;
export type ExpenseSelect = typeof expenses.$inferSelect;
export type TaskSelect = typeof tasks.$inferSelect;
export type StockItemSelect = typeof stockItems.$inferSelect;
export type RecipeSelect = typeof recipes.$inferSelect;
