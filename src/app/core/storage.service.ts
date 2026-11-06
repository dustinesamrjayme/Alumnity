import { Injectable } from '@angular/core';
const DATABASE_NAME = 'alumnity-storage';
const STORE_NAME = 'preferences';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** Single wrapper around device persistence. No localStorage/window.* elsewhere. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  async get<T>(key: string): Promise<T | null> {
    const value = await runTransaction<unknown>('readonly', store => store.get(key));
    return value == null ? null : value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await runTransaction<IDBValidKey>('readwrite', store => store.put(value, key));
  }

  async remove(key: string): Promise<void> {
    await runTransaction<undefined>('readwrite', store => store.delete(key));
  }

  async clear(): Promise<void> {
    await runTransaction<undefined>('readwrite', store => store.clear());
  }
}