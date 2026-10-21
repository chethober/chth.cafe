// Device storage for the workspace: the last synced data, so the app opens without a
// connection, and the changes waiting to be sent once it is back.

/** A change kept on this device until the café API accepts it. */
export interface QueuedRequest {
  seq?: number;
  url: string;
  method: string;
  body?: string;
  queuedAt: string;
  /** The server's reason when it refused the change; refused changes are kept until dismissed. */
  rejected?: string;
}

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  database ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('chth_offline', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('snapshot');
      request.result.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { database = null; throw error; });
  return database;
}

async function run<T>(name: 'snapshot' | 'outbox', mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    const request = action(transaction.objectStore(name));
    transaction.oncomplete = () => resolve(request.result as T);
    transaction.onerror = transaction.onabort = () => reject(transaction.error || request.error);
  });
}

export const deviceStore = {
  readSnapshot: <T>() => run<T | undefined>('snapshot', 'readonly', store => store.get('state')),
  writeSnapshot: (state: unknown) => run<unknown>('snapshot', 'readwrite', store => store.put(state, 'state')),
  queued: () => run<QueuedRequest[]>('outbox', 'readonly', store => store.getAll()),
  queue: (entry: QueuedRequest) => run<number>('outbox', 'readwrite', store => store.add(entry)),
  replace: (entry: QueuedRequest) => run<number>('outbox', 'readwrite', store => store.put(entry)),
  remove: (seq: number) => run<undefined>('outbox', 'readwrite', store => store.delete(seq))
};
