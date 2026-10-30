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
  RecipeSelect,
  CustomerSelect
} from './schema';
import {
  initialSettings,
  initialCategories,
  initialMenuItems,
  initialMenuVariants
} from './seed';
import { deviceStore, type QueuedRequest } from './offline';
import { DEFAULT_STOCK_CATEGORIES, parseStockCategories } from '../utils/stockCategories';
import { currentWorkspace } from '../utils/workspace';

const STORAGE_KEY = 'chth_cafe_settings_v1';

/** One order line as staff enter it. `discountAmount` is for the whole line, not each unit. */
export interface OrderLineInput {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  variants: string[];
  discountAmount?: number;
}

/** Order money as the server works it out: `discountAmount` is every line discount plus `orderDiscount`. */
export function orderAmounts(items: OrderLineInput[], orderDiscount: number, taxRate: number) {
  const round2 = (value: number) => Number(value.toFixed(2));
  const subtotal = round2(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const lineDiscounts = round2(items.reduce((sum, item) => sum + (item.discountAmount || 0), 0));
  const discountAmount = Math.min(subtotal, round2(lineDiscounts + Math.max(0, orderDiscount)));
  const taxAmount = round2(((subtotal - discountAmount) * taxRate) / 100);
  return { subtotal, discountAmount, taxAmount, totalAmount: round2(subtotal - discountAmount + taxAmount) };
}

/** fetch() itself failed: the device has no connection to the café API. */
class OfflineError extends Error {
  constructor() { super('No connection.'); }
}

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
  customers: CustomerSelect[];
  kvCache: {
    cafe_settings_cache?: string;
    public_menu_cache?: string;
    last_invalidated?: string;
  };
}

class CafeStore {
  private state: CafeState;
  private confirmedState: CafeState;
  public saveError = '';
  public pendingSaves = 0;
  private orderAttempts = new Map<string,string>();
  private mutationQueue: Promise<unknown> = Promise.resolve();
  private listeners: Set<() => void> = new Set();
  private lastSyncKey = '';
  /** True when the last request could not reach the café API. */
  public offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  /** Mirror of the device outbox: orders and status changes waiting for a connection. */
  private queued: QueuedRequest[] = [];
  private flushing: Promise<void> | null = null;
  private syncedFromServer = false;

  constructor() {
    this.state = this.loadFromStorage();
    this.confirmedState = structuredClone(this.state);
    this.refreshKVCache();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          void this.syncFromAPI();
        }
      });

      if (SYNC_CHANNEL) SYNC_CHANNEL.onmessage = () => { void this.reloadQueue().then(() => this.syncFromAPI()); };
      window.addEventListener('online', () => { void this.syncFromAPI(); });
      window.addEventListener('offline', () => { this.offline = true; this.notify(); });
      // Show what this device last saw, then fetch the latest records from the API.
      void this.restoreFromDevice().then(() => this.syncFromAPI());
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

  public clearPrivateData() {
    this.state.staff = []; this.state.shifts = []; this.state.orders = [];
    this.state.orderItems = []; this.state.expenses = []; this.state.tasks = [];
    this.state.stockItems = []; this.state.recipes = []; this.state.customers = [];
    this.state.settings.telegramBotToken = ''; this.state.settings.telegramChatId = '';
    this.confirmedState.staff=[]; this.confirmedState.shifts=[]; this.confirmedState.orders=[]; this.confirmedState.orderItems=[]; this.confirmedState.expenses=[]; this.confirmedState.tasks=[]; this.confirmedState.stockItems=[]; this.confirmedState.recipes=[]; this.confirmedState.customers=[];
    this.confirmedState.settings.telegramBotToken=''; this.confirmedState.settings.telegramChatId='';
    this.persistSnapshot();
    this.notify();
  }
  public dismissSaveError() { this.saveError = ''; this.notify(); }
  /** With `queueable`, a missing connection throws OfflineError and leaves local state for the caller to queue. */
  private mutationFetch(url: string, options: RequestInit, queueable = false): Promise<Response> {
    this.pendingSaves++; this.notify();
    const request = this.mutationQueue.then(async () => {
      try {
        const response = await fetch(url, options).catch(() => { this.offline = true; throw new OfflineError(); });
        this.offline = false;
        const result = await response.clone().json().catch(() => null) as { success?: boolean; message?: string } | null;
        if (!response.ok || result?.success === false) throw new Error(result?.message || 'The server did not save this change.');
        if (SYNC_CHANNEL) SYNC_CHANNEL.postMessage({ type: 'STORE_UPDATED' });
        return response;
      } catch (error) {
        if (queueable && error instanceof OfflineError) throw error;
        this.state = structuredClone(this.confirmedState);
        this.applyQueued();
        this.saveToStorage();
        this.saveError = `${error instanceof Error ? error.message : 'Network unavailable.'} Changes may not be saved. Review the refreshed data before retrying.`;
        throw error;
      } finally {
        this.pendingSaves--; this.notify();
        if (!this.pendingSaves) await this.syncFromAPI();
      }
    });
    this.mutationQueue = request.catch(() => {});
    return request;
  }

  public async syncFromAPI() {
    if (typeof window === 'undefined') return;
    try {
      // Queued changes go first, so the data read below already includes them.
      if (this.queuedCount) await this.flushQueue();
      let session: any = null;
      try {
        const response = await fetch('/api/auth/session');
        session = await response.json().catch(() => null);
      } catch {
        // No connection: keep showing what this device last synced.
        if (!this.offline) { this.offline = true; this.notify(); }
        return;
      }
      if (this.offline) { this.offline = false; this.notify(); }
      const managementView = currentWorkspace() !== null;
      const adminAccess = session?.authenticated && currentWorkspace() === 'admin';
      // Nothing was written since the last complete sync for this access level, so skip re-reading every table.
      const syncKey = typeof session?.version === 'number' ? `${session.version}|${Boolean(session.authenticated)}|${managementView}|${Boolean(adminAccess)}` : '';
      if (syncKey && syncKey === this.lastSyncKey) return;
      let incomplete = false;
      const fetchJSON = (url: string) => this.safeFetchJSON(url).then(result => { if (!result) incomplete = true; return result; });
      const privateFetch = (url: string) => session?.authenticated && managementView ? fetchJSON(url) : Promise.resolve(null);
      if (!session?.authenticated || !managementView) this.clearPrivateData();
      const [ordersData, orderItemsData, tasksData, staffData, shiftsData, expensesData, settingsData, menuData, stockData, recipesData, customersData] = await Promise.all([
        privateFetch('/api/orders'),
        privateFetch('/api/order-items'),
        privateFetch('/api/tasks'),
        privateFetch('/api/staff'),
        privateFetch('/api/staff/shifts'),
        adminAccess ? privateFetch('/api/expenses') : Promise.resolve(null),
        fetchJSON(adminAccess ? '/api/admin/settings' : '/api/settings'),
        fetchJSON(adminAccess ? '/api/admin/menu' : '/api/menu'),
        privateFetch('/api/stock'),
        privateFetch('/api/recipes'),
        privateFetch('/api/customers')
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
      if (customersData?.data && Array.isArray(customersData.data)) {
        this.state.customers = customersData.data;
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
        this.syncedFromServer = true;
        this.confirmedState = structuredClone(this.state);
        this.persistSnapshot();
        this.applyQueued();
        this.saveToStorage();
        this.notify();
      }
      this.lastSyncKey = incomplete ? '' : syncKey;
    } catch (e) {
      console.warn('syncFromAPI error:', e);
    }
  }

  // --- Offline: the last sync and queued changes live in IndexedDB on this device. ---
  public get queuedCount() { return this.queued.filter(entry => !entry.rejected).length; }
  /** Queued changes the server refused when they were finally sent. */
  public getRejectedChanges(): Array<{ seq: number; label: string; reason: string }> {
    return this.queued.filter(entry => entry.rejected).map(entry => ({ seq: entry.seq!, label: this.describeQueued(entry), reason: entry.rejected! }));
  }
  public async dismissRejectedChanges() {
    await Promise.all(this.queued.filter(entry => entry.rejected).map(entry => deviceStore.remove(entry.seq!))).catch(() => {});
    await this.reloadQueue();
    this.notify();
  }
  private describeQueued(entry: QueuedRequest): string {
    const body = entry.body ? JSON.parse(entry.body) : {};
    if (entry.url === '/api/orders') return `Order ${body.orderNumber} for ${body.customerName || 'walk-in'} (${body.totalAmount})`;
    return 'An order status change';
  }

  private async restoreFromDevice() {
    try {
      const [snapshot, queued] = await Promise.all([deviceStore.readSnapshot<Omit<CafeState, 'kvCache'>>(), deviceStore.queued()]);
      this.queued = queued;
      // A sync that finished first is newer than anything stored on the device.
      if (snapshot && !this.syncedFromServer) {
        this.state = { ...this.state, ...snapshot, settings: { ...this.state.settings, ...snapshot.settings } };
        this.confirmedState = structuredClone(this.state);
      }
      this.applyQueued();
      this.refreshKVCache();
      this.notify();
    } catch {
      // IndexedDB is unavailable (private window, blocked storage): the app works online only.
    }
  }

  private async reloadQueue() {
    try { this.queued = await deviceStore.queued(); } catch { /* storage unavailable */ }
  }

  /** Keeps the last server data on the device, without secrets or staff PINs. */
  private persistSnapshot() {
    if (typeof window === 'undefined') return;
    const { kvCache, ...data } = this.confirmedState;
    void deviceStore.writeSnapshot({
      ...data,
      settings: { ...data.settings, telegramBotToken: '', telegramChatId: '' },
      staff: data.staff.map(member => ({ ...member, pin: '' }))
    }).catch(() => {});
  }

  /** Lays queued orders and status changes over the server data, so the board shows them until they are sent. */
  private applyQueued() {
    for (const entry of this.queued) {
      if (entry.rejected || !entry.body) continue;
      const body = JSON.parse(entry.body);
      if (entry.method === 'POST' && entry.url === '/api/orders') {
        const { items, ...order } = body;
        if (!this.state.orders.some(existing => existing.id === order.id)) this.putOrder(order, items);
      }
      const statusFor = entry.method === 'PUT' && entry.url.match(/^\/api\/orders\/([^/]+)\/status$/);
      const order = statusFor && this.state.orders.find(existing => existing.id === decodeURIComponent(statusFor[1]));
      if (order) order.status = body.status;
    }
  }

  public isQueuedOrder(orderId: string): boolean {
    return this.queued.some(entry => !entry.rejected && entry.url === '/api/orders' && entry.body?.includes(`"id":"${orderId}"`));
  }

  /**
   * Sends a change now, or keeps it on this device when there is no connection.
   * Resolves to null when the change was queued; local state is kept either way.
   */
  private async queueableMutation(url: string, options: RequestInit & { body?: string }): Promise<Response | null> {
    // Behind changes already waiting, so the server receives them in the order they were made.
    if (!this.queuedCount) {
      try { return await this.mutationFetch(url, options, true); }
      catch (error) { if (!(error instanceof OfflineError)) throw error; }
    }
    try {
      await deviceStore.queue({ url, method: options.method || 'POST', body: options.body, queuedAt: new Date().toISOString() });
      await this.reloadQueue();
    } catch {
      this.state = structuredClone(this.confirmedState);
      this.applyQueued();
      this.saveError = 'No connection, and this browser cannot keep changes offline. This change was not saved.';
      this.notify();
      throw new Error(this.saveError);
    }
    this.notify();
    if (!this.offline) void this.syncFromAPI();
    return null;
  }

  /** Sends queued changes in order. Web Locks keep two open tabs from sending the same change twice. */
  public flushQueue(): Promise<void> {
    this.flushing ||= (async () => {
      const send = async () => {
        let changed = false;
        // Read the device copy: another tab may already have sent some of these.
        for (const entry of await deviceStore.queued()) {
          if (entry.rejected) continue;
          let response: Response;
          try {
            response = await fetch(entry.url, { method: entry.method, headers: { 'Content-Type': 'application/json' }, body: entry.body });
          } catch { this.offline = true; break; }
          this.offline = false;
          const result = await response.clone().json().catch(() => null) as { success?: boolean; message?: string } | null;
          if (response.ok && result && result.success !== false) { await deviceStore.remove(entry.seq!); changed = true; continue; }
          // Signed out, or the server is having trouble: keep everything and try again later.
          if (response.status === 401 || response.status >= 500 || !result) break;
          await deviceStore.replace({ ...entry, rejected: result.message || 'The server refused this change.' });
          changed = true;
        }
        return changed;
      };
      try {
        const changed = navigator.locks ? await navigator.locks.request('chth_outbox', send) : await send();
        // Re-read everything, so sent orders come back from the server and refused ones leave the board.
        if (changed) { this.lastSyncKey = ''; SYNC_CHANNEL?.postMessage({ type: 'STORE_UPDATED' }); }
      } catch {
        // Storage unavailable: nothing could have been queued.
      }
      await this.reloadQueue();
      this.notify();
    })().finally(() => { this.flushing = null; });
    return this.flushing;
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
          ...parsedSettings,
          telegramBotToken: '', telegramChatId: ''
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...initialState.settings, telegramBotToken: '', telegramChatId: '' }));
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
      staff: [],
      shifts: [],
      orders: [],
      orderItems: [],
      expenses: [],
      tasks: [],
      stockItems: [],
      recipes: [],
      customers: [],
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.state.settings, telegramBotToken: '', telegramChatId: '' }));
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
      cafe_settings_cache: JSON.stringify({ ...this.state.settings, telegramBotToken: '', telegramChatId: '' }),
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
      this.mutationFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state.settings)
      }).catch((err) => console.warn('API Update Settings Error:', err));
    }

    return this.state.settings;
  }

  public async saveSettings(settings: SettingsSelect): Promise<SettingsSelect> {
    const response = await this.mutationFetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const result = await response.json().catch(() => null) as {
      success?: boolean; message?: string; data?: SettingsSelect;
    } | null;
    if (!response.ok || !result?.success || result.data?.id !== settings.id) {
      throw new Error(result?.message || 'Settings could not be saved. Please try again.');
    }
    this.state.settings = result.data;
    this.refreshKVCache();
    this.saveToStorage();
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
        this.mutationFetch(`/api/menu/items/${itemId}/stock`, {
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
      this.mutationFetch('/api/menu/categories', {
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
        this.mutationFetch(`/api/menu/categories/${catId}`, {
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
        this.mutationFetch(`/api/menu/categories/${catId}`, { method: 'DELETE' }).catch((err) =>
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
      this.mutationFetch('/api/menu/items', {
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
        this.mutationFetch(`/api/menu/items/${itemId}`, {
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
        this.mutationFetch(`/api/menu/items/${itemId}`, { method: 'DELETE' }).catch((err) =>
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
      this.mutationFetch('/api/staff', {
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
        this.mutationFetch(`/api/staff/${staffId}`, {
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
        this.mutationFetch(`/api/staff/${staffId}`, { method: 'DELETE' }).catch((err) =>
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
      this.mutationFetch('/api/staff/clock-in', {
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
      this.mutationFetch('/api/staff/clock-out', {
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
        this.mutationFetch(`/api/staff/shifts/${shiftId}`, {
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
      this.mutationFetch('/api/staff/shifts', {
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
        this.mutationFetch(`/api/staff/shifts/${shiftId}`, { method: 'DELETE' }).catch((err) =>
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

  /** Public checkout only commits local state after the server accepts the order. */
  public async submitPublicOrder(
    input: Parameters<CafeStore['createOrder']>[0],
    submissionId: string
  ): Promise<OrderSelect & { trackingToken?: string }> {
    const subtotal = Number(input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2));
    const taxAmount = Number((subtotal * this.state.settings.taxRate / 100).toFixed(2));
    const payload = {
      ...input,
      id: submissionId,
      orderNumber: `#${submissionId.replace(/^public-/, '').slice(0, 8).toUpperCase()}`,
      customerName: input.customerName?.trim() || 'Guest Customer',
      subtotal, taxAmount, discountAmount: 0,
      totalAmount: Number((subtotal + taxAmount).toFixed(2)),
      status: 'pending', createdAt: new Date().toISOString()
    };
    const response = await this.mutationFetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null) as {
      success?: boolean; message?: string; data?: OrderSelect & { trackingToken?: string };
    } | null;
    if (!response.ok || result?.success !== true || result?.data?.id !== submissionId) {
      throw new Error(result?.message || 'We couldn’t confirm your order. Please try again.');
    }
    const order = result.data;
    // Public receipts are kept separately; do not copy management records into the public store.
    return order;
  }

  public recordConfirmedOrder(order: OrderSelect, items: Parameters<CafeStore['createOrder']>[0]['items']): void {
    this.putOrder(order, items);
    this.saveToStorage();
    this.notify();
  }

  private putOrder(order: OrderSelect, items: Parameters<CafeStore['createOrder']>[0]['items']): void {
    this.state.orders = [order, ...this.state.orders.filter(existing => existing.id !== order.id)];
    this.state.orderItems = [
      ...items.map((item, index) => ({
        id: `${order.id}-item-${index}`, orderId: order.id,
        menuItemId: item.menuItemId, itemName: item.itemName,
        quantity: item.quantity, unitPrice: item.unitPrice,
        variantsJson: JSON.stringify(item.variants),
        discountAmount: item.discountAmount || 0,
        itemTotal: Number((item.quantity * item.unitPrice - (item.discountAmount || 0)).toFixed(2))
      })),
      ...this.state.orderItems.filter(item => item.orderId !== order.id)
    ];
  }

  public getOrderItems(orderId?: string): OrderItemSelect[] {
    if (orderId) {
      return this.state.orderItems.filter((item) => item.orderId === orderId);
    }
    return this.state.orderItems;
  }

  public async createOrder(orderInput: {
    customerName?: string;
    customerId?: string | null;
    orderType: 'dine_in' | 'takeout' | 'pickup';
    paymentMethod: 'cash' | 'card' | 'google_pay' | 'online';
    /** Taken off the whole order, on top of any line discounts. */
    discountAmount?: number;
    status?: 'pending' | 'preparing' | 'completed' | 'cancelled';
    createdAt?: string;
    items: OrderLineInput[];
  }): Promise<OrderSelect> {
    const signature = JSON.stringify({ ...orderInput, createdAt: undefined });
    const orderId = this.orderAttempts.get(signature) || `ord-${crypto.randomUUID()}`;
    this.orderAttempts.set(signature, orderId);
    // Known before the server answers, so an order taken offline keeps the number staff called out.
    const orderNumber = `#${orderId.slice(4, 12).toUpperCase()}`;
    const { subtotal, discountAmount, taxAmount, totalAmount } = orderAmounts(orderInput.items, orderInput.discountAmount || 0, this.state.settings.taxRate);
    const now = orderInput.createdAt || new Date().toISOString();

    const newOrder: OrderSelect = {
      id: orderId,
      orderNumber,
      customerName: orderInput.customerName || 'Walk-in Customer',
      customerId: orderInput.customerId || null,
      orderType: orderInput.orderType,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paymentMethod: orderInput.paymentMethod,
      status: orderInput.status || 'pending',
      createdAt: now
    };

    if (typeof window === 'undefined') {
      this.recordConfirmedOrder(newOrder, orderInput.items); return newOrder;
    }
    const response = await this.queueableMutation('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newOrder, items: orderInput.items })
    });
    this.orderAttempts.delete(signature);
    if (!response) {
      // Kept on this device; it is sent, and checked by the server, once the connection is back.
      this.recordConfirmedOrder(newOrder, orderInput.items);
      return newOrder;
    }
    const result = await response.json() as { data: OrderSelect };
    return result.data;
  }

  /**
   * Replaces an order's lines and details. Waits for the server, which may refuse when there is not enough stock,
   * so the editor can say why. Orders still waiting on this device cannot be edited until they are sent.
   */
  public async updateOrder(orderId: string, input: {
    customerName: string;
    customerId: string | null;
    orderType: 'dine_in' | 'takeout' | 'pickup';
    paymentMethod: string;
    /** Taken off the whole order, on top of any line discounts. */
    orderDiscount: number;
    items: OrderLineInput[];
  }): Promise<OrderSelect> {
    const { orderDiscount, ...details } = input;
    const { discountAmount } = orderAmounts(input.items, orderDiscount, this.state.settings.taxRate);
    const response = await this.formMutation(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...details, discountAmount })
    });
    const { data } = await response.json() as { data: { order: OrderSelect; items: OrderItemSelect[] } };
    this.state.orders = this.state.orders.map(order => order.id === orderId ? data.order : order);
    this.state.orderItems = [...data.items, ...this.state.orderItems.filter(item => item.orderId !== orderId)];
    this.notify();
    return data.order;
  }

  public deleteOrder(orderId: string): boolean {
    const lenBefore = this.state.orders.length;
    this.state.orders = this.state.orders.filter((o) => o.id !== orderId);
    this.state.orderItems = this.state.orderItems.filter((oi) => oi.orderId !== orderId);
    if (this.state.orders.length !== lenBefore) {
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        this.mutationFetch(`/api/orders/${orderId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Order Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  public updateOrderStatus(
    orderId: string,
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  ): OrderSelect | undefined {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = status;
      this.saveToStorage();

      if (typeof window !== 'undefined') {
        this.queueableMutation(`/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }).catch((err) => console.warn('API Update Order Status Error:', err));
      }

      return order;
    }
    return undefined;
  }


  // --- 4b. Customer Club ---
  /** For saves made from a form: the form shows the server's reason, so the page-wide banner stays quiet. */
  private async formMutation(url: string, options: RequestInit): Promise<Response> {
    try { return await this.mutationFetch(url, options); }
    catch (error) { this.dismissSaveError(); throw error; }
  }

  public getCustomers(): CustomerSelect[] {
    return this.state.customers;
  }

  /** Waits for the server, which owns phone uniqueness, so the form can show why a sign-up was refused. */
  public async createCustomer(input: Pick<CustomerSelect, 'name' | 'phone' | 'notes'>): Promise<CustomerSelect> {
    const response = await this.formMutation('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, id: `cus-${crypto.randomUUID()}` })
    });
    const { data } = await response.json() as { data: CustomerSelect };
    this.state.customers = [...this.state.customers, data].sort((a, b) => a.name.localeCompare(b.name));
    this.confirmedState.customers = structuredClone(this.state.customers);
    this.notify();
    return data;
  }

  public async updateCustomer(customerId: string, input: Pick<CustomerSelect, 'name' | 'phone' | 'notes'>): Promise<CustomerSelect> {
    const response = await this.formMutation(`/api/customers/${customerId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const { data } = await response.json() as { data: CustomerSelect };
    this.state.customers = this.state.customers.map(c => c.id === customerId ? data : c);
    this.confirmedState.customers = structuredClone(this.state.customers);
    this.notify();
    return data;
  }

  public deleteCustomer(customerId: string): void {
    this.state.customers = this.state.customers.filter(c => c.id !== customerId);
    this.state.orders = this.state.orders.map(o => o.customerId === customerId ? { ...o, customerId: null } : o);
    this.notify();
    this.mutationFetch(`/api/customers/${customerId}`, { method: 'DELETE' }).catch(err => console.warn('API Delete Customer Error:', err));
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
      this.mutationFetch('/api/expenses', {
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
        this.mutationFetch(`/api/expenses/${expenseId}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Expense Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  public getFinancialAnalytics() {
    const totalSalesRevenue = Number(
      this.state.orders.filter(order => order.status === 'completed').reduce((acc, order) => acc + order.totalAmount, 0).toFixed(2)
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
      totalOrdersCount: this.state.orders.filter(order => order.status === 'completed').length,
      averageOrderValue: this.state.orders.some(order => order.status === 'completed') ? Number((totalSalesRevenue / this.state.orders.filter(order => order.status === 'completed').length).toFixed(2)) : 0
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
      this.mutationFetch('/api/tasks', {
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
        this.mutationFetch(`/api/tasks/${taskId}/status`, {
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
        this.mutationFetch(`/api/tasks/${taskId}`, { method: 'DELETE' }).catch((err) =>
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
      this.mutationFetch('/api/stock', {
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
        this.mutationFetch(`/api/stock/${id}`, {
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
        this.mutationFetch(`/api/stock/${id}`, { method: 'DELETE' }).catch((err) =>
          console.warn('API Delete Stock Item Error:', err)
        );
      }

      return true;
    }
    return false;
  }

  /** The admin's category list, followed by any category a material uses that is missing from it. */
  public getStockCategories(): string[] {
    const saved = parseStockCategories(this.state.settings.stockCategories) ?? DEFAULT_STOCK_CATEGORIES;
    const unlisted = this.state.stockItems.map(item => item.category).filter(name => !saved.includes(name));
    return [...saved, ...new Set(unlisted)];
  }

  public async saveStockCategories(categories: string[]): Promise<string[]> {
    const response = await this.formMutation('/api/stock-categories', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories })
    });
    const { data } = await response.json() as { data: string[] };
    this.state.settings = { ...this.state.settings, stockCategories: JSON.stringify(data) };
    this.notify();
    return data;
  }

  /** Renames a category and moves its materials along; renaming onto an existing category merges the two. */
  public async renameStockCategory(from: string, to: string): Promise<string> {
    const response = await this.formMutation('/api/stock-categories/rename', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to })
    });
    const { data } = await response.json() as { data: { categories: string[]; name: string } };
    this.state.settings = { ...this.state.settings, stockCategories: JSON.stringify(data.categories) };
    this.state.stockItems = this.state.stockItems.map(item => item.category === from ? { ...item, category: data.name } : item);
    this.notify();
    return data.name;
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
      this.mutationFetch(`/api/menu/${menuItemId}/recipe`, {
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
