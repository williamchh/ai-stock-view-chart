/**
 * Helper class for managing IndexedDB operations for chart drawings
 */
export class IndexedDBHelper {
    constructor() {
        this.dbName = 'StockChartDrawings';
        this.dbVersion = 1;
        this.storeName = 'drawings';
        this.db = null;
    }

    /**
     * Initialize the IndexedDB database
     * @returns {Promise<IDBDatabase>} The database instance
     */
    async init() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = (event) => {
                this.db = /** @type {IDBDatabase} */ (/** @type {IDBOpenDBRequest} */ (event.target).result);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = /** @type {IDBDatabase} */ (/** @type {IDBOpenDBRequest} */ (event.target).result);
                
                // Create object store for drawings if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    
                    // Create indexes for efficient querying
                    store.createIndex('chartName', 'chartName', { unique: false });
                    store.createIndex('chartCode', 'chartCode', { unique: false });
                    store.createIndex('chartNameAndCode', ['chartName', 'chartCode'], { unique: false });
                }
            };
        });
    }

    /**
     * Save drawings for a specific chart
     * @param {Object} chartName - Chart name information {name, code, metaString}
     * @param {Array} drawings - Array of drawing objects
     * @returns {Promise<void>}
     */
    async saveDrawings(chartName, drawings) {
        if (!chartName || (!chartName.name && !chartName.code)) {
            console.warn('Chart name is required to save drawings');
            return;
        }

        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // First, clear existing drawings for this chart
            const clearRequest = store.index('chartNameAndCode').getAll(
                [chartName.name || '', chartName.code || '']
            );

            clearRequest.onsuccess = () => {
                const existingDrawings = clearRequest.result;
                
                // Delete existing drawings
                existingDrawings.forEach(drawing => {
                    store.delete(drawing.id);
                });

                // Add new drawings
                drawings.forEach(drawing => {
                    const drawingToSave = {
                        ...drawing,
                        chartName: chartName.name || '',
                        chartCode: chartName.code || '',
                        chartMetaString: chartName.metaString || '',
                        timestamp: Date.now()
                    };
                    store.add(drawingToSave);
                });
            };

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = () => {
                reject(new Error('Failed to save drawings'));
            };
        });
    }

    /**
     * Load drawings for a specific chart
     * @param {Object} chartName - Chart name information {name, code, metaString}
     * @returns {Promise<Array>} Array of drawing objects
     */
    async loadDrawings(chartName) {
        if (!chartName || (!chartName.name && !chartName.code)) {
            return [];
        }

        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.index('chartNameAndCode').getAll(
                [chartName.name || '', chartName.code || '']
            );

            request.onsuccess = () => {
                const drawings = request.result;
                // Remove IndexedDB specific fields before returning
                const cleanDrawings = drawings.map(drawing => {
                    const { id, chartName, chartCode, chartMetaString, timestamp, ...drawingData } = drawing;
                    return drawingData;
                });
                resolve(cleanDrawings);
            };

            request.onerror = () => {
                reject(new Error('Failed to load drawings'));
            };
        });
    }

    /**
     * Clear all drawings from the database
     * @returns {Promise<void>}
     */
    async clearAllDrawings() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to clear drawings'));
            };
        });
    }

    /**
     * Get all chart names that have drawings
     * @returns {Promise<Array>} Array of unique chart name objects
     */
    async getAllChartNames() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            const request = store.getAll();

            request.onsuccess = () => {
                const drawings = request.result;
                const uniqueCharts = new Map();
                
                drawings.forEach(drawing => {
                    const key = `${drawing.chartName}|${drawing.chartCode}`;
                    if (!uniqueCharts.has(key)) {
                        uniqueCharts.set(key, {
                            name: drawing.chartName,
                            code: drawing.chartCode,
                            metaString: drawing.chartMetaString
                        });
                    }
                });
                
                resolve(Array.from(uniqueCharts.values()));
            };

            request.onerror = () => {
                reject(new Error('Failed to get chart names'));
            };
        });
    }
}

// Export singleton instance
export const indexedDBHelper = new IndexedDBHelper();