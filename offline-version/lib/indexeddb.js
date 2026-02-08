class IndexedDBManager {
  constructor() {
    this.dbName = 'SocialMediaAssistant';
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('collectedItems')) {
          const store = db.createObjectStore('collectedItems', { keyPath: 'id' });
          store.createIndex('platform', 'platform', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('collectedAt', 'collectedAt', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains('mediaFiles')) {
          const store = db.createObjectStore('mediaFiles', { keyPath: 'id' });
          store.createIndex('itemId', 'itemId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('downloadHistory')) {
          const store = db.createObjectStore('downloadHistory', { keyPath: 'id' });
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains('exportTasks')) {
          const store = db.createObjectStore('exportTasks', { keyPath: 'id' });
          store.createIndex('exportedAt', 'exportedAt', { unique: false });
          store.createIndex('format', 'format', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id' });
          store.createIndex('platform', 'platform', { unique: false });
          store.createIndex('username', 'username', { unique: false });
        }
      };
    });
  }

  async add(storeName, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async query(storeName, options = {}) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      let request;

      if (options.index && options.value) {
        const index = store.index(options.index);
        const range = IDBKeyRange.only(options.value);
        request = index.openCursor(range);
      } else {
        request = store.openCursor();
      }

      const results = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (!options.filter || options.filter(cursor.value)) {
            results.push(cursor.value);
          }
          if (!options.limit || results.length < options.limit) {
            cursor.continue();
          } else {
            resolve(results);
          }
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getStatistics() {
    const [itemsCount, mediaCount, downloadsCount, exportsCount, usersCount] = await Promise.all([
      this.count('collectedItems'),
      this.count('mediaFiles'),
      this.count('downloadHistory'),
      this.count('exportTasks'),
      this.count('users')
    ]);

    return {
      collectedItems: itemsCount,
      mediaFiles: mediaCount,
      downloads: downloadsCount,
      exports: exportsCount,
      users: usersCount
    };
  }

  async exportData(storeName) {
    const data = await this.getAll(storeName);
    return JSON.stringify(data, null, 2);
  }

  async importData(storeName, jsonData) {
    const data = JSON.parse(jsonData);
    await this.clear(storeName);

    for (const item of data) {
      await this.put(storeName, item);
    }
  }
}

const dbManager = new IndexedDBManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = dbManager;
}
