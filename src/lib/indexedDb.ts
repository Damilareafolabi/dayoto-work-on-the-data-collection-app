import { FormDefinition, Submission } from '../types/survey.ts';

const DB_NAME = 'cmrg_datacollect_db';
const DB_VERSION = 1;

export interface OfflineDbInstance {
  db: IDBDatabase;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('forms')) {
        db.createObjectStore('forms', { keyPath: 'formId' });
      }

      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'instanceId' });
      }

      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'instanceId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('synced')) {
        db.createObjectStore('synced', { keyPath: 'instanceId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save forms list to IndexedDB
 */
export async function saveFormsToIndexedDb(forms: FormDefinition[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('forms', 'readwrite');
    const store = tx.objectStore('forms');
    for (const form of forms) {
      store.put(form);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB forms write fallback to localStorage:', err);
  }
}

/**
 * Fetch forms from IndexedDB
 */
export async function getFormsFromIndexedDb(): Promise<FormDefinition[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('forms', 'readonly');
    const store = tx.objectStore('forms');
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Save draft response to IndexedDB
 */
export async function saveDraftToIndexedDb(sub: Submission): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('drafts', 'readwrite');
    tx.objectStore('drafts').put(sub);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB draft save fallback:', err);
  }
}

/**
 * Enqueue completed submission for central server synchronization
 */
export async function enqueueSubmission(sub: Submission): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(['sync_queue', 'drafts'], 'readwrite');
    tx.objectStore('sync_queue').put(sub);
    // Remove from drafts if present
    tx.objectStore('drafts').delete(sub.instanceId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB enqueue fallback:', err);
  }
}

/**
 * Get all queued submissions awaiting confirmation from server
 */
export async function getQueuedSubmissions(): Promise<Submission[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * When server confirms receipt, move submission from sync_queue to synced archive
 */
export async function markConfirmedByServer(instanceId: string, syncedAt: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(['sync_queue', 'synced'], 'readwrite');
    const queueStore = tx.objectStore('sync_queue');
    const syncedStore = tx.objectStore('synced');

    const getReq = queueStore.get(instanceId);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.status = 'synced';
        item.syncedAt = syncedAt;
        syncedStore.put(item);
        queueStore.delete(instanceId);
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB confirm update fallback:', err);
  }
}
