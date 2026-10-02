import { DEFAULT_APPEARANCE } from '../utils/appearance';
import {
  SettingsSelect,
  CategorySelect,
  MenuItemSelect,
  MenuVariantSelect,
  StaffSelect,
  ShiftSelect,
  OrderSelect,
  OrderItemSelect,
  ExpenseSelect,
  TaskSelect,
  StockItemSelect,
  RecipeSelect
} from './schema';

export const initialSettings: SettingsSelect = {
  id: 'cafe_config',
  timeZone: 'Asia/Tehran',
  cafeName: 'CHTH',
  logoUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80',
  brandPrimary: '#059669', // Emerald Tea Green
  brandSecondary: '#064e3b', // Forest Dark
  appearance: JSON.stringify(DEFAULT_APPEARANCE),
  currency: '₹',
  taxRate: 8.5,
  openHours: JSON.stringify({
    Monday: { open: '07:00', close: '19:00', closed: false },
    Tuesday: { open: '07:00', close: '19:00', closed: false },
    Wednesday: { open: '07:00', close: '19:00', closed: false },
    Thursday: { open: '07:00', close: '19:00', closed: false },
    Friday: { open: '07:00', close: '21:00', closed: false },
    Saturday: { open: '08:00', close: '21:00', closed: false },
    Sunday: { open: '08:00', close: '18:00', closed: false }
  }),
  contactPhone: '+1 (555) 382-9104',
  address: '123 Cafe Street, Downtown',
  telegramBotToken: '',
  telegramChatId: '',
  notifySales: true,
  notifyShifts: true,
  notifyTasks: true,
  notifyDailyReport: true,
  notifyLowStock: true,
  updatedAt: new Date().toISOString()
};

export const initialCategories: CategorySelect[] = [
  { id: 'cat-matcha', name: 'Artisan Teas & Matcha', displayOrder: 1, icon: 'Leaf' },
  { id: 'cat-espresso', name: 'Espresso & Hot Brews', displayOrder: 2, icon: 'Coffee' },
  { id: 'cat-iced', name: 'Iced Elixirs & Cold Brews', displayOrder: 3, icon: 'GlassWater' },
  { id: 'cat-bakery', name: 'Fresh Bakery & Pastries', displayOrder: 4, icon: 'Cake' },
  { id: 'cat-brunch', name: 'Brunch & Artisanal Toast', displayOrder: 5, icon: 'Utensils' }
];

export const initialMenuItems: MenuItemSelect[] = [
  {
    id: 'item-espresso',
    categoryId: 'cat-espresso',
    name: 'Espresso',
    description: 'Classic double shot artisanal espresso.',
    basePrice: 120,
    profitMargin: 100.20,
    isInStock: true,
    badge: 'Classic',
    imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-americano',
    categoryId: 'cat-espresso',
    name: 'Americano',
    description: 'Double espresso diluted with hot filtered water.',
    basePrice: 140,
    profitMargin: 120.20,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-cortado',
    categoryId: 'cat-espresso',
    name: 'Cortado',
    description: 'Equal parts espresso and warm silky milk.',
    basePrice: 160,
    profitMargin: 135.40,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-cappuccino',
    categoryId: 'cat-espresso',
    name: 'Cappuccino',
    description: 'Espresso with rich velvety steamed milk foam.',
    basePrice: 210,
    profitMargin: 174.20,
    isInStock: true,
    badge: 'Popular',
    imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668ba67e53?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-latte',
    categoryId: 'cat-espresso',
    name: 'Latte',
    description: 'Smooth espresso with micro-foamed milk.',
    basePrice: 210,
    profitMargin: 174.20,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-matcha-latte',
    categoryId: 'cat-matcha',
    name: 'Matcha Latte',
    description: 'First-harvest Uji matcha whisked with milk.',
    basePrice: 280,
    profitMargin: 201.40,
    isInStock: true,
    badge: 'Signature',
    imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-spanish-latte',
    categoryId: 'cat-espresso',
    name: 'Spanish Latte',
    description: 'Espresso combined with sweetened condensed milk.',
    basePrice: 250,
    profitMargin: 205.69,
    isInStock: true,
    badge: 'Bestseller',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-vietnamese',
    categoryId: 'cat-espresso',
    name: 'Vietnamese Coffee',
    description: 'Dark roast drip coffee with condensed milk.',
    basePrice: 280,
    profitMargin: 242.09,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-mocha',
    categoryId: 'cat-espresso',
    name: 'Mocha',
    description: 'Espresso infused with dark chocolate & steamed milk.',
    basePrice: 250,
    profitMargin: 191.45,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-hot-chocolate',
    categoryId: 'cat-iced',
    name: 'Hot Chocolate',
    description: 'Rich dark chocolate melted into warm creamy milk.',
    basePrice: 280,
    profitMargin: 216.75,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-frappe',
    categoryId: 'cat-iced',
    name: 'Frappe',
    description: 'Blended iced coffee elixir with velvety foam.',
    basePrice: 310,
    profitMargin: 222.34,
    isInStock: true,
    badge: 'Popular',
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-irani-tea',
    categoryId: 'cat-matcha',
    name: 'Irani Tea',
    description: 'Classic dum brewed sweet chai.',
    basePrice: 100,
    profitMargin: 96.20,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-masala-tea',
    categoryId: 'cat-matcha',
    name: 'Masala Tea',
    description: 'Aromatic tea infused with cardamom, ginger & spices.',
    basePrice: 100,
    profitMargin: 91.20,
    isInStock: true,
    badge: 'Bestseller',
    imageUrl: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-green-tea',
    categoryId: 'cat-matcha',
    name: 'Green Tea',
    description: 'Pure whole leaf green tea brew.',
    basePrice: 150,
    profitMargin: 150.00,
    isInStock: true,
    badge: 'Organic',
    imageUrl: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-hibiscus-tea',
    categoryId: 'cat-matcha',
    name: 'Hibiscus Tea',
    description: 'Tart & floral ruby red herbal tea.',
    basePrice: 150,
    profitMargin: 147.92,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-chamomile-tea',
    categoryId: 'cat-matcha',
    name: 'Chamomile Tea',
    description: 'Soothing Egyptian chamomile blossom tea.',
    basePrice: 150,
    profitMargin: 150.00,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-purple-peace',
    categoryId: 'cat-matcha',
    name: 'Purple Peace',
    description: 'Butterfly pea flower & lavender soothing tea.',
    basePrice: 210,
    profitMargin: 210.00,
    isInStock: true,
    badge: 'Specialty',
    imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-persian-snap',
    categoryId: 'cat-iced',
    name: 'Persian Snap',
    description: 'Saffron & rose infused cold refreshment.',
    basePrice: 250,
    profitMargin: 250.00,
    isInStock: true,
    badge: 'Signature',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-brain-freeze',
    categoryId: 'cat-iced',
    name: 'Brain Freeze',
    description: 'Intense double espresso slush over crushed ice.',
    basePrice: 280,
    profitMargin: 260.20,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-creamy-mushroom-sandwich',
    categoryId: 'cat-brunch',
    name: 'Creamy Mushroom (Sandwich)',
    description: 'Sautéed mushrooms, garlic cream cheese on sourdough.',
    basePrice: 290,
    profitMargin: 192.91,
    isInStock: true,
    badge: 'Chef Special',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-tandoori-paneer-sandwich',
    categoryId: 'cat-brunch',
    name: 'Tandoori Paneer (Sandwich)',
    description: 'Spiced tandoori paneer cubes & crisp lettuce toastie.',
    basePrice: 310,
    profitMargin: 249.61,
    isInStock: true,
    badge: 'Popular',
    imageUrl: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-dead-by-cheese-sandwich',
    categoryId: 'cat-brunch',
    name: 'Dead By Cheese (Sandwich)',
    description: 'Triple cheese blend grilled sourdough sandwich.',
    basePrice: 320,
    profitMargin: 320.00,
    isInStock: true,
    badge: 'Bestseller',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-creamy-mushroom-pasta',
    categoryId: 'cat-brunch',
    name: 'Creamy Mushroom (Pasta)',
    description: 'Penne pasta in rich garlic & mushroom white sauce.',
    basePrice: 280,
    profitMargin: 152.43,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-tandoori-paneer-pasta',
    categoryId: 'cat-brunch',
    name: 'Tandoori Paneer (Pasta)',
    description: 'Penne pasta tossed in spicy tandoori paneer sauce.',
    basePrice: 290,
    profitMargin: 185.65,
    isInStock: true,
    badge: '',
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-dead-by-cheese-pasta',
    categoryId: 'cat-brunch',
    name: 'Dead By Cheese (Pasta)',
    description: 'Macaroni & penne in rich four-cheese sauce bake.',
    basePrice: 310,
    profitMargin: 236.43,
    isInStock: true,
    badge: 'Popular',
    imageUrl: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  },
  {
    id: 'item-messy-platter',
    categoryId: 'cat-brunch',
    name: 'Messy Platter',
    description: 'Assorted messy dips, sourdough crisps & loaded sides.',
    basePrice: 200,
    profitMargin: 170.75,
    isInStock: true,
    badge: 'Sharing',
    imageUrl: 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80',
    createdAt: '2026-07-01T08:00:00.000Z'
  }
];

export const initialMenuVariants: MenuVariantSelect[] = [
  { id: 'var-mc-oat', menuItemId: 'item-iced-matcha', groupName: 'Milk Choice', name: 'Oat Milk', priceModifier: 0.0 },
  { id: 'var-mc-coco', menuItemId: 'item-iced-matcha', groupName: 'Milk Choice', name: 'Coconut Milk', priceModifier: 0.50 },
  { id: 'var-sz-reg', menuItemId: 'item-honey-latte', groupName: 'Size', name: 'Regular (12oz)', priceModifier: 0.0 },
  { id: 'var-sz-lrg', menuItemId: 'item-honey-latte', groupName: 'Size', name: 'Large (16oz)', priceModifier: 0.85 },
  { id: 'var-mlk-whl', menuItemId: 'item-honey-latte', groupName: 'Milk Choice', name: 'Whole Milk', priceModifier: 0.0 },
  { id: 'var-mlk-oat', menuItemId: 'item-honey-latte', groupName: 'Milk Choice', name: 'Oat Milk', priceModifier: 0.75 }
];

// --- Demo staff data ---
export const initialStaff: StaffSelect[] = [
  {
    id: 'staff-demo-1',
    name: 'Alex',
    role: 'Manager',
    pin: '',
    hourlyRate: 25.00,
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'staff-demo-2',
    name: 'Jordan',
    role: 'Barista',
    pin: '',
    hourlyRate: 18.50,
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'staff-demo-3',
    name: 'Taylor',
    role: 'Barista',
    pin: '',
    hourlyRate: 18.50,
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z'
  }
];

export const initialShifts: ShiftSelect[] = [
  { id: 'shift-demo-1', staffId: 'staff-demo-1', clockIn: '2026-07-01T08:00:00.000Z', clockOut: '2026-07-01T16:00:00.000Z', totalHours: 8.0, totalPay: 200.0, notes: 'Demo shift', createdAt: '2026-07-01T08:00:00.000Z' },
  { id: 'shift-demo-2', staffId: 'staff-demo-2', clockIn: '2026-07-01T09:00:00.000Z', clockOut: '2026-07-01T17:00:00.000Z', totalHours: 8.0, totalPay: 148.0, notes: 'Demo shift', createdAt: '2026-07-01T09:00:00.000Z' }
];

export const initialOrders: OrderSelect[] = [];

export const initialOrderItems: OrderItemSelect[] = [];

export const initialExpenses: ExpenseSelect[] = [];

// --- Demo tasks ---
export const initialTasks: TaskSelect[] = [
  {
    id: 'task-demo-1',
    title: 'Refill Syrups',
    description: 'Replenish vanilla, caramel, and lavender syrup bottles on front bar station.',
    category: 'Opening',
    priority: 'medium',
    status: 'completed',
    assignedStaffId: 'staff-demo-2',
    dueDate: '2026-07-24',
    completedAt: '2026-07-24T05:31:07.000Z',
    createdAt: '2026-07-24T04:40:00.000Z'
  },
  {
    id: 'task-demo-2',
    title: 'Check Ingredient Stock',
    description: 'Verify matcha powder, espresso beans, oat milk, and whole milk stock levels.',
    category: 'Inventory',
    priority: 'high',
    status: 'in_progress',
    assignedStaffId: 'staff-demo-3',
    dueDate: '2026-07-24',
    completedAt: null,
    createdAt: '2026-07-24T04:40:00.000Z'
  },
  {
    id: 'task-demo-3',
    title: 'Clean Espresso Machine',
    description: 'Backflush group heads and sanitize steam wands.',
    category: 'Cleaning',
    priority: 'high',
    status: 'pending',
    assignedStaffId: 'staff-demo-2',
    dueDate: '2026-07-24',
    completedAt: null,
    createdAt: '2026-07-24T12:00:00.000Z'
  }
];

export const initialStockItems: StockItemSelect[] = [
  {
    id: 'stock-1',
    name: 'Ceremonial Uji Matcha Powder',
    category: 'Tea & Coffee',
    quantity: 4.5,
    unit: 'kg',
    unitCost: 3200.00,
    totalPrice: 14400.00,
    minThreshold: 5.0,
    updatedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'stock-2',
    name: 'Single-Origin Espresso Beans',
    category: 'Tea & Coffee',
    quantity: 18.0,
    unit: 'kg',
    unitCost: 1400.00,
    totalPrice: 25200.00,
    minThreshold: 10.0,
    updatedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'stock-3',
    name: 'Organic Oat Milk',
    category: 'Dairy & Milk',
    quantity: 35.0,
    unit: 'liters',
    unitCost: 180.00,
    totalPrice: 6300.00,
    minThreshold: 15.0,
    updatedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'stock-4',
    name: 'Wild Mountain Honey',
    category: 'Syrups & Flavors',
    quantity: 8.0,
    unit: 'kg',
    unitCost: 650.00,
    totalPrice: 5200.00,
    minThreshold: 3.0,
    updatedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'stock-5',
    name: 'Vanilla Bean Cold Foam Syrup',
    category: 'Syrups & Flavors',
    quantity: 2.5,
    unit: 'liters',
    unitCost: 450.00,
    totalPrice: 1125.00,
    minThreshold: 4.0,
    updatedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'stock-6',
    name: 'Artisanal Sourdough Bread Loaves',
    category: 'Bakery & Flour',
    quantity: 12.0,
    unit: 'units',
    unitCost: 120.00,
    totalPrice: 1440.00,
    minThreshold: 5.0,
    updatedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'stock-7',
    name: 'Organic Hass Avocados',
    category: 'Produce',
    quantity: 25.0,
    unit: 'units',
    unitCost: 45.00,
    totalPrice: 1125.00,
    minThreshold: 8.0,
    updatedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z'
  }
];

export const initialRecipes: RecipeSelect[] = [
  { id: 'rcp-1', menuItemId: 'item-iced-matcha', stockItemId: 'stock-1', quantityRequired: 0.015 },
  { id: 'rcp-2', menuItemId: 'item-iced-matcha', stockItemId: 'stock-3', quantityRequired: 0.250 },
  { id: 'rcp-3', menuItemId: 'item-iced-matcha', stockItemId: 'stock-5', quantityRequired: 0.030 },
  { id: 'rcp-4', menuItemId: 'item-honey-latte', stockItemId: 'stock-2', quantityRequired: 0.018 },
  { id: 'rcp-5', menuItemId: 'item-honey-latte', stockItemId: 'stock-4', quantityRequired: 0.020 },
  { id: 'rcp-6', menuItemId: 'item-avocado-toast', stockItemId: 'stock-6', quantityRequired: 1.0 },
  { id: 'rcp-7', menuItemId: 'item-avocado-toast', stockItemId: 'stock-7', quantityRequired: 0.5 }
];
