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
import {
  initialSettings,
  initialCategories,
  initialMenuItems,
  initialMenuVariants,
  initialStaff,
  initialShifts,
  initialOrders,
  initialOrderItems,
  initialExpenses,
  initialTasks,
  initialStockItems,
  initialRecipes
} from './seed';

const STORAGE_KEY = 'chth_cafe_settings_v1';

const SYNC_CHANNEL =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('chth_store_sync')
    : null;

export interface CafeState {
  settings: SettingsSelect;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  menuVariants: MenuVariantSelect[];
  staff: StaffSelect[];
  shifts: ShiftSelect[];
  orders: OrderSelect[];
  orderItems: OrderItemSelect[];
  expenses: ExpenseSelect[];
  tasks: TaskSelect[];
  stockItems: StockItemSelect[];
  recipes: RecipeSelect[];
  kvCache: {
    cafe_settings_cache?: string;
    public_menu_cache?: string;
    last_invalidated?: string;
  };
}

class CafeStore {
  private state: CafeState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadFromStorage();
    this.refreshKVCache();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.syncFromStorage();
        }
      });

      if (SYNC_CHANNEL) {
        SYNC_CHANNEL.onmessage = (e) => {
          if (e.data?.type === 'STORE_UPDATED') {
            if (e.data?.state) {
              this.syncFromStorage(e.data.state);
            } else {
              this.syncFromStorage();
            }
          }
        };
      }

      window.addEventListener('message', (e) => {
        if (e.data?.type === 'CHTH_STORE_UPDATED' && e.data?.state) {
          this.syncFromStorage(e.data.state);
        } else if (e.data?.type === 'CHTH_REQUEST_SYNC') {
          if (e.source && 'postMessage' in e.source) {
            try {
              (e.source as Window).postMessage(
                { type: 'CHTH_STORE_UPDATED', state: this.state },
                '*'
              );
            } catch (err) {}
          }
        }
      });

      // Send a sync request to any opener/parent window upon load
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'CHTH_REQUEST_SYNC' }, '*');
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'CHTH_REQUEST_SYNC' }, '*');
        }
      } catch (err) {}

      // Asynchronously fetch latest records from backend D1 database API
      this.syncFromAPI();
    }
  }

  private async safeFetchJSON(url: string): Promise<any | null> {
    try {
      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {
      // Ignore network or parsing error
    }
    return null;
  }

  public async syncFromAPI() {
    if (typeof window === 'undefined') return;
    try {
      const [ordersData, orderItemsData, tasksData, staffData, shiftsData, expensesData, settingsData, menuData, stockData, recipesData] = await Promise.all([
        this.safeFetchJSON('/api/orders'),
        this.safeFetchJSON('/api/order-items'),
        this.safeFetchJSON('/api/tasks'),
        this.safeFetchJSON('/api/staff'),
        this.safeFetchJSON('/api/staff/shifts'),
        this.safeFetchJSON('/api/expenses'),
        this.safeFetchJSON('/api/settings'),
        this.safeFetchJSON('/api/menu'),
        this.safeFetchJSON('/api/stock'),
        this.safeFetchJSON('/api/recipes')
      ]);

      let hasChanges = false;
      if (stockData?.data && Array.isArray(stockData.data)) {
        this.state.stockItems = stockData.data;
        hasChanges = true;
      }
      if (recipesData?.data && Array.isArray(recipesData.data)) {
        this.state.recipes = recipesData.data;
        hasChanges = true;
      }
      if (ordersData?.data && Array.isArray(ordersData.data)) {
        this.state.orders = ordersData.data;
        hasChanges = true;
      }
      if (orderItemsData?.data && Array.isArray(orderItemsData.data)) {
        this.state.orderItems = orderItemsData.data;
        hasChanges = true;
      }
      if (tasksData?.data && Array.isArray(tasksData.data)) {
        this.state.tasks = tasksData.data;
        hasChanges = true;
      }
      if (staffData?.data && Array.isArray(staffData.data)) {
        this.state.staff = staffData.data;
        hasChanges = true;
      }
      if (shiftsData?.data && Array.isArray(shiftsData.data)) {
        this.state.shifts = shiftsData.data;
        hasChanges = true;
      }
      if (expensesData?.data && Array.isArray(expensesData.data)) {
        this.state.expenses = expensesData.data;
        hasChanges = true;
      }
      if (settingsData?.data && typeof settingsData.data === 'object') {
        this.state.settings = { ...this.state.settings, ...settingsData.data };
        hasChanges = true;
      }
      // Sync menu categories, items, and variants from the combined /api/menu response
      if (menuData?.data && Array.isArray(menuData.data)) {
        const categories: any[] = [];
        const menuItems: any[] = [];
        const menuVariants: any[] = [];
        for (const cat of menuData.data) {
          const { items, ...catData } = cat;
          categories.push(catData);
          if (items && Array.isArray(items)) {
            for (const item of items) {
              const { variants, ...itemData } = item;
              menuItems.push(itemData);
              if (variants && Array.isArray(variants)) {
                menuVariants.push(...variants);
              }
            }
          }
        }
        this.state.categories = categories;
        this.state.menuItems = menuItems;
        this.state.menuVariants = menuVariants;
        hasChanges = true;
      }

      if (hasChanges) {
        this.saveToStorage();
        this.notify();
      }
    } catch (e) {
      console.warn('syncFromAPI error:', e);
    }
  }

  public syncFromStorage(externalState?: CafeState) {
    if (externalState) {
      this.state = externalState;
    } else {
      this.state = this.loadFromStorage();
    }
    this.refreshKVCache();
    this.notify();
  }

  private loadFromStorage(): CafeState {
    const initialState = this.getInitialState();
    if (typeof window === 'undefined') {
      return initialState;
    }
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        initialState.settings = {
          ...initialState.settings,
          ...parsedSettings
        };
        if (!initialState.settings.cafeName || initialState.settings.cafeName.includes('Velvet')) {
          initialState.settings.cafeName = 'CHTH';
        }
      }
    } catch (e) {
      console.warn('Failed to load settings from local storage:', e);
    }
    return initialState;
  }

  private getInitialState(): CafeState {
    return {
      settings: { ...initialSettings },
      categories: [...initialCategories],
      menuItems: [...initialMenuItems],
      menuVariants: [...initialMenuVariants],
      staff: [...initialStaff],
      shifts: [...initialShifts],
      orders: [...initialOrders],
      orderItems: [...initialOrderItems],
      expenses: [...initialExpenses],
      tasks: [...initialTasks],
      stockItems: [...initialStockItems],
      recipes: [...initialRecipes],
      kvCache: {}
    };
  }

  public resetToDemoData(): void {
    this.state = this.getInitialState();
    this.refreshKVCache();
    this.saveToStorage();
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.settings));
        if (SYNC_CHANNEL) {
          SYNC_CHANNEL.postMessage({ type: 'STORE_UPDATED', state: this.state });
        }
        const msg = { type: 'CHTH_STORE_UPDATED', state: this.state };
        if (window.opener && !window.opener.closed) {
          try { window.opener.postMessage(msg, '*'); } catch (e) {}
        }
        if (window.parent && window.parent !== window) {
          try { window.parent.postMessage(msg, '*'); } catch (e) {}
        }
      } catch (e) {
        console.error('Error saving settings state:', e);
      }
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  // --- Cloudflare KV Caching Mechanism Simulation ---
  public refreshKVCache() {
    const publicMenuData = this.state.categories.map((cat) => ({
      ...cat,
      items: this.state.menuItems
        .filter((item) => item.categoryId === cat.id)
        .map((item) => ({
          ...item,
          variants: this.state.menuVariants.filter((v) => v.menuItemId === item.id)
        }))
    }));

    this.state.kvCache = {
      cafe_settings_cache: JSON.stringify(this.state.settings),
      public_menu_cache: JSON.stringify(publicMenuData),
      last_invalidated: new Date().toISOString()
    };
  }

  public getKVCache() {
    return this.state.kvCache;
  }

  public getState(): CafeState {
    return this.state;
  }

  // --- 1. Settings & Branding ---
  public getSettings(): SettingsSelect {
    return this.state.settings;
  }

  public updateSettings(partial: Partial<SettingsSelect>): SettingsSelect {
    this.state.settings = {
      ...this.state.settings,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    this.refreshKVCache();
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state.settings)
      }).catch((err) => console.warn('API Update Settings Error:', err));
    }

    return this.state.settings;
  }

  // --- 2. Menu & Stock Management ---
  public getCategories(): CategorySelect[] {
    return [...this.state.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public getMenuItems(): MenuItemSelect[] {
    return this.state.menuItems;
  }

  public getMenuVariants(itemId?: string): MenuVariantSelect[] {
    if (itemId) {
      return this.state.menuVariants.filter((v) => v.menuItemId === itemId);
    }
    return this.state.menuVariants;
  }

  public toggleStock(itemId: string, isInStock?: boolean): MenuItemSelect | undefined {
    const item = this.state.menuItems.find((i) => i.id === itemId);
    if (item) {
      const newStockStatus = isInStock !== undefined ? isInStock : !item.isInStock;
      item.isInStock = newStockStatus;
      this.refreshKVCache();
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/menu/items/${itemId}/stock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isInStock: newStockStatus })
        }).catch((err) => console.warn('API Toggle Stock Error:', err));
      }

      return item;
    }
    return undefined;
  }

  public createCategory(name: string, icon: string = 'Coffee', id?: string, displayOrder?: number): CategorySelect {
    const newCat: CategorySelect = {
      id: id || `cat-${Date.now()}`,
      name,
      displayOrder: displayOrder ?? (this.state.categories.length + 1),
      icon
    };
    this.state.categories.push(newCat);
    this.refreshKVCache();
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch('/api/menu/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat)
      }).catch((err) => console.warn('API Create Category Error:', err));
    }

    return newCat;
  }

  public updateCategory(catId: string, partial: Partial<CategorySelect>): CategorySelect | undefined {
    const idx = this.state.categories.findIndex((c) => c.id === catId);
    if (idx !== -1) {
      this.state.categories[idx] = { ...this.state.categories[idx], ...partial };
      this.refreshKVCache();
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/menu/categories/${catId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial)
        }).catch((err) => console.warn('API Update Category Error:', err));
      }

      return this.state.categories[idx];
    }
    return undefined;
  }

  public deleteCategory(catId: string): boolean {
    const initialLen = this.state.categories.length;
    this.state.categories = this.state.categories.filter((c) => c.id !== catId);

    if (this.state.categories.length !== initialLen) {
      // Remove all items in this category
      const itemsInCat = this.state.menuItems.filter((i) => i.categoryId === catId);
      itemsInCat.forEach((item) => {
        this.deleteMenuItem(item.id);
      });

      this.refreshKVCache();
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/menu/categories/${catId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Category Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  public createMenuItem(
    itemData: Omit<MenuItemSelect, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
    variants: Array<{ id?: string; groupName: string; name: string; priceModifier: number }> = []
  ): MenuItemSelect {
    const itemId = itemData.id || `item-${Date.now()}`;
    const newItem: MenuItemSelect = {
      ...itemData,
      id: itemId,
      createdAt: itemData.createdAt || new Date().toISOString()
    };

    const newVariants: MenuVariantSelect[] = variants.map((v, idx) => ({
      id: v.id || `var-${Date.now()}-${idx}`,
      menuItemId: itemId,
      groupName: v.groupName,
      name: v.name,
      priceModifier: v.priceModifier
    }));

    this.state.menuItems.push(newItem);
    this.state.menuVariants.push(...newVariants);
    this.refreshKVCache();
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: newItem, variants: newVariants })
      }).catch((err) => console.warn('API Create Menu Item Error:', err));
    }

    return newItem;
  }

  public updateMenuItem(itemId: string, partial: Partial<MenuItemSelect>): MenuItemSelect | undefined {
    const index = this.state.menuItems.findIndex((i) => i.id === itemId);
    if (index !== -1) {
      this.state.menuItems[index] = { ...this.state.menuItems[index], ...partial };
      this.refreshKVCache();
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/menu/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial)
        }).catch((err) => console.warn('API Update Menu Item Error:', err));
      }

      return this.state.menuItems[index];
    }
    return undefined;
  }

  public deleteMenuItem(itemId: string): boolean {
    const initialLen = this.state.menuItems.length;
    this.state.menuItems = this.state.menuItems.filter((i) => i.id !== itemId);
    this.state.menuVariants = this.state.menuVariants.filter((v) => v.menuItemId !== itemId);
    if (this.state.menuItems.length !== initialLen) {
      this.refreshKVCache();
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/menu/items/${itemId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Menu Item Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  // --- 3. Staff & PIN Time Tracker ---
  public getStaff(): StaffSelect[] {
    return this.state.staff;
  }

  public createStaff(staffData: Omit<StaffSelect, 'id' | 'createdAt'>): StaffSelect {
    const newMember: StaffSelect = {
      ...staffData,
      id: `staff-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    this.state.staff.push(newMember);
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      }).catch((err) => console.warn('API Create Staff Error:', err));
    }

    return newMember;
  }

  public updateStaff(staffId: string, partial: Partial<StaffSelect>): StaffSelect | undefined {
    const idx = this.state.staff.findIndex((s) => s.id === staffId);
    if (idx !== -1) {
      this.state.staff[idx] = { ...this.state.staff[idx], ...partial };
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/staff/${staffId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial)
        }).catch((err) => console.warn('API Update Staff Error:', err));
      }

      return this.state.staff[idx];
    }
    return undefined;
  }

  public deleteStaff(staffId: string): boolean {
    const initialLen = this.state.staff.length;
    this.state.staff = this.state.staff.filter((s) => s.id !== staffId);
    if (this.state.staff.length !== initialLen) {
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/staff/${staffId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Staff Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  public verifyStaffPin(pin: string, staffId?: string): StaffSelect | undefined {
    const trimmed = pin.trim();
    if (!trimmed) return undefined;

    if (staffId) {
      const staffMember = this.state.staff.find((s) => s.id === staffId);
      if (staffMember && (staffMember.pin === trimmed || staffMember.pin.toLowerCase() === trimmed.toLowerCase())) {
        return staffMember;
      }
      return undefined;
    }

    return this.state.staff.find(
      (s) => s.status === 'active' && (s.pin === trimmed || s.pin.toLowerCase() === trimmed.toLowerCase())
    );
  }

  public clockIn(pin: string, notes: string = '', staffId?: string): { success: boolean; message: string; shift?: ShiftSelect; staff?: StaffSelect } {
    const staffMember = this.verifyStaffPin(pin, staffId);
    if (!staffMember) {
      return { success: false, message: 'Incorrect employee password. Access denied.' };
    }

    const activeShift = this.state.shifts.find((s) => s.staffId === staffMember.id && !s.clockOut);
    if (activeShift) {
      return { success: false, message: `${staffMember.name} is already clocked in!`, staff: staffMember };
    }

    const now = new Date().toISOString();
    const newShift: ShiftSelect = {
      id: `shift-${Date.now()}`,
      staffId: staffMember.id,
      clockIn: now,
      clockOut: null,
      totalHours: 0.0,
      totalPay: 0.0,
      notes,
      createdAt: now
    };

    this.state.shifts.unshift(newShift);
    this.saveToStorage();

    // Persist to D1 via API
    if (typeof window !== 'undefined') {
      fetch('/api/staff/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, notes, staffId: staffMember.id, shift: newShift })
      }).catch((err) => console.warn('API Clock-In Error:', err));
    }

    return { success: true, message: `Welcome, ${staffMember.name}! Clocked in successfully.`, shift: newShift, staff: staffMember };
  }

  public clockOut(pin: string, notes: string = '', staffId?: string): { success: boolean; message: string; shift?: ShiftSelect; staff?: StaffSelect } {
    const staffMember = this.verifyStaffPin(pin, staffId);
    if (!staffMember) {
      return { success: false, message: 'Incorrect employee password. Access denied.' };
    }

    const activeShift = this.state.shifts.find((s) => s.staffId === staffMember.id && !s.clockOut);
    if (!activeShift) {
      return { success: false, message: `${staffMember.name} is not currently clocked in.`, staff: staffMember };
    }

    const now = new Date().toISOString();
    const startTime = new Date(activeShift.clockIn).getTime();
    const endTime = new Date(now).getTime();
    const diffHours = Math.max(0.1, Number(((endTime - startTime) / (1000 * 60 * 60)).toFixed(2)));
    const totalPay = Number((diffHours * staffMember.hourlyRate).toFixed(2));

    activeShift.clockOut = now;
    activeShift.totalHours = diffHours;
    activeShift.totalPay = totalPay;
    if (notes) {
      activeShift.notes = activeShift.notes ? `${activeShift.notes} | ${notes}` : notes;
    }

    this.saveToStorage();

    // Persist to D1 via API
    if (typeof window !== 'undefined') {
      fetch('/api/staff/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, notes, staffId: staffMember.id, shift: activeShift })
      }).catch((err) => console.warn('API Clock-Out Error:', err));
    }

    return {
      success: true,
      message: `Goodbye, ${staffMember.name}! Clocked out. Total hours worked: ${diffHours}h.`,
      shift: activeShift,
      staff: staffMember
    };
  }

  public getShifts(): ShiftSelect[] {
    return this.state.shifts;
  }

  public updateShift(shiftId: string, partial: Partial<ShiftSelect>): ShiftSelect | undefined {
    const idx = this.state.shifts.findIndex((s) => s.id === shiftId);
    if (idx !== -1) {
      const updated = { ...this.state.shifts[idx], ...partial };
      if (updated.clockIn && updated.clockOut) {
        const diffMs = new Date(updated.clockOut).getTime() - new Date(updated.clockIn).getTime();
        const hrs = Math.max(0.1, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));
        updated.totalHours = hrs;
      }
      this.state.shifts[idx] = updated;
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/staff/shifts/${shiftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial)
        }).catch((err) => console.warn('API Update Shift Error:', err));
      }

      return updated;
    }
    return undefined;
  }

  public createShift(shiftInput: {
    staffId: string;
    clockIn: string;
    clockOut?: string | null;
    notes?: string;
  }): ShiftSelect {
    const now = new Date().toISOString();
    const staffMember = this.state.staff.find((s) => s.id === shiftInput.staffId);
    const hourlyRate = staffMember ? staffMember.hourlyRate : 18.5;

    let totalHours = 0.0;
    let totalPay = 0.0;

    if (shiftInput.clockIn && shiftInput.clockOut) {
      const diffMs = new Date(shiftInput.clockOut).getTime() - new Date(shiftInput.clockIn).getTime();
      totalHours = Math.max(0.1, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));
      totalPay = Number((totalHours * hourlyRate).toFixed(2));
    }

    const newShift: ShiftSelect = {
      id: `shift-${Date.now()}`,
      staffId: shiftInput.staffId,
      clockIn: shiftInput.clockIn,
      clockOut: shiftInput.clockOut || null,
      totalHours,
      totalPay,
      notes: shiftInput.notes || '',
      createdAt: now
    };

    this.state.shifts.unshift(newShift);
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch('/api/staff/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftInput)
      }).catch((err) => console.warn('API Create Shift Error:', err));
    }

    return newShift;
  }

  public deleteShift(shiftId: string): boolean {
    const initialLen = this.state.shifts.length;
    this.state.shifts = this.state.shifts.filter((s) => s.id !== shiftId);
    if (this.state.shifts.length !== initialLen) {
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/staff/shifts/${shiftId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Shift Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  public reorderShifts(fromIdx: number, toIdx: number): void {
    if (fromIdx < 0 || fromIdx >= this.state.shifts.length || toIdx < 0 || toIdx >= this.state.shifts.length) return;
    const item = this.state.shifts.splice(fromIdx, 1)[0];
    this.state.shifts.splice(toIdx, 0, item);
    this.saveToStorage();
  }

  // --- 4. Cash Flow & Orders ---
  public getOrders(): OrderSelect[] {
    return this.state.orders;
  }

  public getOrderItems(orderId?: string): OrderItemSelect[] {
    if (orderId) {
      return this.state.orderItems.filter((item) => item.orderId === orderId);
    }
    return this.state.orderItems;
  }

  public createOrder(orderInput: {
    customerName?: string;
    orderType: 'dine_in' | 'takeout' | 'pickup';
    paymentMethod: 'cash' | 'card' | 'google_pay' | 'online';
    discountAmount?: number;
    status?: 'pending' | 'preparing' | 'completed' | 'cancelled';
    createdAt?: string;
    items: Array<{
      menuItemId: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
      variants: string[];
    }>;
  }): OrderSelect {
    const orderId = `ord-${Date.now()}`;
    const orderNumber = `#${1000 + this.state.orders.length + 1}`;
    const subtotal = Number(
      orderInput.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
    );
    const discountAmount = Math.max(0, Number((orderInput.discountAmount || 0).toFixed(2)));
    const netSubtotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
    const taxAmount = Number(((netSubtotal * this.state.settings.taxRate) / 100).toFixed(2));
    const totalAmount = Number((netSubtotal + taxAmount).toFixed(2));
    const now = orderInput.createdAt || new Date().toISOString();

    const newOrder: OrderSelect = {
      id: orderId,
      orderNumber,
      customerName: orderInput.customerName || 'Walk-in Customer',
      orderType: orderInput.orderType,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paymentMethod: orderInput.paymentMethod,
      status: orderInput.status || 'pending',
      createdAt: now
    };

    const newOrderItems: OrderItemSelect[] = orderInput.items.map((item, idx) => ({
      id: `item-ord-${Date.now()}-${idx}`,
      orderId,
      menuItemId: item.menuItemId,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      variantsJson: JSON.stringify(item.variants),
      itemTotal: Number((item.unitPrice * item.quantity).toFixed(2))
    }));

    this.state.orders.unshift(newOrder);
    this.state.orderItems.unshift(...newOrderItems);
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newOrder, items: orderInput.items })
      }).catch((err) => console.warn('API Post Order Error:', err));
    }

    return newOrder;
  }

  public deleteOrder(orderId: string): boolean {
    const lenBefore = this.state.orders.length;
    this.state.orders = this.state.orders.filter((o) => o.id !== orderId);
    this.state.orderItems = this.state.orderItems.filter((oi) => oi.orderId !== orderId);
    if (this.state.orders.length !== lenBefore) {
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/orders/${orderId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Order Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  public updateOrderStatus(
    orderId: string,
    status: 'pending' | 'preparing' | 'completed' | 'cancelled'
  ): OrderSelect | undefined {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = status;
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }).catch((err) => console.warn('API Update Order Status Error:', err));
      }

      return order;
    }
    return undefined;
  }


  // --- 5. Expenses & Financial Analytics ---
  public getExpenses(): ExpenseSelect[] {
    return this.state.expenses;
  }

  public createExpense(expenseData: Omit<ExpenseSelect, 'id' | 'createdAt'>): ExpenseSelect {
    const newExp: ExpenseSelect = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    this.state.expenses.unshift(newExp);
    this.saveToStorage();

    // Persist to D1 via API
    if (typeof window !== 'undefined') {
      fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExp)
      }).catch((err) => console.warn('API Create Expense Error:', err));
    }

    return newExp;
  }

  public deleteExpense(expenseId: string): boolean {
    const lenBefore = this.state.expenses.length;
    this.state.expenses = this.state.expenses.filter((e) => e.id !== expenseId);
    if (this.state.expenses.length !== lenBefore) {
      this.saveToStorage();

      // Persist to D1 via API
      if (typeof window !== 'undefined') {
        fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Expense Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  public getFinancialAnalytics() {
    const totalSalesRevenue = Number(
      this.state.orders.reduce((acc, order) => acc + order.totalAmount, 0).toFixed(2)
    );

    const totalManualExpenses = Number(
      this.state.expenses.reduce((acc, exp) => acc + exp.amount, 0).toFixed(2)
    );

    const totalLaborWages = Number(
      this.state.shifts.reduce((acc, shift) => acc + (shift.totalPay || 0), 0).toFixed(2)
    );

    const combinedExpenses = Number((totalManualExpenses + totalLaborWages).toFixed(2));
    const netProfit = Number((totalSalesRevenue - combinedExpenses).toFixed(2));
    const profitMargin = totalSalesRevenue > 0 ? Number(((netProfit / totalSalesRevenue) * 100).toFixed(1)) : 0;

    const categoryTotals: Record<string, number> = {};
    this.state.expenses.forEach((exp) => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    if (totalLaborWages > 0) {
      categoryTotals['Labor Wages (Staff)'] = (categoryTotals['Labor Wages (Staff)'] || 0) + totalLaborWages;
    }

    return {
      totalSalesRevenue,
      totalManualExpenses,
      totalLaborWages,
      combinedExpenses,
      netProfit,
      profitMargin,
      categoryTotals,
      totalOrdersCount: this.state.orders.length,
      averageOrderValue: this.state.orders.length > 0 ? Number((totalSalesRevenue / this.state.orders.length).toFixed(2)) : 0
    };
  }

  // --- 6. Admin Task Manager ---
  public getTasks(): TaskSelect[] {
    return this.state.tasks;
  }

  public createTask(taskData: Omit<TaskSelect, 'id' | 'createdAt' | 'completedAt'>): TaskSelect {
    const newTask: TaskSelect = {
      ...taskData,
      id: `task-${Date.now()}`,
      completedAt: null,
      createdAt: new Date().toISOString()
    };
    this.state.tasks.unshift(newTask);
    this.saveToStorage();

    // Persist to D1 via API
    if (typeof window !== 'undefined') {
      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      }).catch((err) => console.warn('API Create Task Error:', err));
    }

    return newTask;
  }

  public updateTaskStatus(taskId: string, status: 'pending' | 'in_progress' | 'completed'): TaskSelect | undefined {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === 'completed') {
        task.completedAt = new Date().toISOString();
      } else {
        task.completedAt = null;
      }
      this.saveToStorage();

      // Persist to D1 via API
      if (typeof window !== 'undefined') {
        fetch(`/api/tasks/${taskId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }).catch((err) => console.warn('API Update Task Error:', err));
      }

      return task;
    }
    return undefined;
  }

  public deleteTask(taskId: string): boolean {
    const lenBefore = this.state.tasks.length;
    this.state.tasks = this.state.tasks.filter((t) => t.id !== taskId);
    if (this.state.tasks.length !== lenBefore) {
      this.saveToStorage();

      // Persist to D1 via API
      if (typeof window !== 'undefined') {
        fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Task Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  // --- Stock Management Methods ---
  public getStockItems(): StockItemSelect[] {
    return this.state.stockItems || [];
  }

  public addStockItem(item: Omit<StockItemSelect, 'id' | 'createdAt' | 'updatedAt' | 'totalPrice'> & { id?: string }): StockItemSelect {
    const now = new Date().toISOString();
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost) || 0;
    const newItem: StockItemSelect = {
      id: item.id || `stock-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      category: item.category || 'Tea & Coffee',
      quantity: qty,
      unit: item.unit || 'kg',
      unitCost: cost,
      totalPrice: Number((qty * cost).toFixed(2)),
      minThreshold: Number(item.minThreshold) || 5.0,
      createdAt: now,
      updatedAt: now
    };

    this.state.stockItems.unshift(newItem);
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      }).catch((err) => console.warn('API Add Stock Item Error:', err));
    }

    return newItem;
  }

  public updateStockItem(id: string, updates: Partial<Omit<StockItemSelect, 'id' | 'createdAt'>>): StockItemSelect | undefined {
    const itemIndex = this.state.stockItems.findIndex((s) => s.id === id);
    if (itemIndex !== -1) {
      const existing = this.state.stockItems[itemIndex];
      const qty = updates.quantity !== undefined ? Number(updates.quantity) : existing.quantity;
      const cost = updates.unitCost !== undefined ? Number(updates.unitCost) : existing.unitCost;
      const totalPrice = Number((qty * cost).toFixed(2));

      const updated: StockItemSelect = {
        ...existing,
        ...updates,
        quantity: qty,
        unitCost: cost,
        totalPrice,
        updatedAt: new Date().toISOString()
      };

      this.state.stockItems[itemIndex] = updated;
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/stock/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        }).catch((err) => console.warn('API Update Stock Item Error:', err));
      }

      return updated;
    }
    return undefined;
  }

  public adjustStockQuantity(id: string, delta: number): StockItemSelect | undefined {
    const existing = this.state.stockItems.find((s) => s.id === id);
    if (existing) {
      const newQty = Math.max(0, Number((existing.quantity + delta).toFixed(2)));
      return this.updateStockItem(id, { quantity: newQty });
    }
    return undefined;
  }

  public deleteStockItem(id: string): boolean {
    const lenBefore = this.state.stockItems.length;
    this.state.stockItems = this.state.stockItems.filter((s) => s.id !== id);
    // Also cleanup recipes referencing this stock item
    this.state.recipes = this.state.recipes.filter((r) => r.stockItemId !== id);

    if (this.state.stockItems.length !== lenBefore) {
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        fetch(`/api/stock/${id}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Stock Item Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  // --- Recipe Methods ---
  public getRecipes(): RecipeSelect[] {
    return this.state.recipes || [];
  }

  public getMenuItemRecipe(menuItemId: string): RecipeSelect[] {
    return (this.state.recipes || []).filter((r) => r.menuItemId === menuItemId);
  }

  public saveMenuItemRecipe(
    menuItemId: string,
    ingredients: Array<{ stockItemId: string; quantityRequired: number }>
  ): RecipeSelect[] {
    // Remove existing recipe ingredients for this menu item
    this.state.recipes = (this.state.recipes || []).filter((r) => r.menuItemId !== menuItemId);

    const newRecipes: RecipeSelect[] = ingredients.map((ing, idx) => ({
      id: `rcp-${menuItemId}-${idx + 1}-${Date.now().toString(36)}`,
      menuItemId,
      stockItemId: ing.stockItemId,
      quantityRequired: Number(ing.quantityRequired) || 0
    }));

    this.state.recipes.push(...newRecipes);
    this.saveToStorage();

    if (typeof window !== 'undefined') {
      fetch(`/api/menu/${menuItemId}/recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients })
      }).catch((err) => console.warn('API Save Recipe Error:', err));
    }

    return newRecipes;
  }

  public resetToDefaults() {
    this.state = this.getInitialState();
    this.refreshKVCache();
    this.saveToStorage();
  }
}

export const store = new CafeStore();
