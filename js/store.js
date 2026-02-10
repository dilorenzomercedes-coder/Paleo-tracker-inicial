class Store {
    constructor() {
        this.STORAGE_KEY_HALLAZGOS = 'paleo_hallazgos';
        this.STORAGE_KEY_FRAGMENTOS = 'paleo_fragmentos';
        this.STORAGE_KEY_ROUTES = 'paleo_routes';
        this.STORAGE_KEY_DOCUMENTS = 'paleo_documents';

        // Internal cache to keep the API synchronous for the UI
        this.cache = {
            hallazgos: [],
            fragmentos: [],
            routes: [],
            documents: []
        };

        this.MAX_IMAGE_DIMENSION = 800;
        this.IMAGE_QUALITY = 0.6;

        // Backend sync configuration
        this.BACKEND_URL = localStorage.getItem('backend_url') || 'https://paleo-tracker-backend.onrender.com';
        this.collectorId = this._getOrCreateCollectorId();
        this.collectorName = localStorage.getItem('collector_name') || '';

        // Initialize Dexie with sync status
        this.db = new Dexie("PaleoTrackerDB");
        this.db.version(2).stores({
            hallazgos: 'id, timestamp, folder, synced',
            fragmentos: 'id, timestamp, folder, synced',
            routes: 'id, timestamp, synced',
            documents: 'id, timestamp, category, synced',
            sharedDocuments: 'id, timestamp, category' // Documentos compartidos por admin
        });

        this.initialized = false;
        this.initPromise = this._init();
    }

    _getOrCreateCollectorId() {
        let id = localStorage.getItem('collector_id');
        if (!id) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            id = `collector_${timestamp}_${random}`;
            localStorage.setItem('collector_id', id);
        }
        return id;
    }

    async _init() {
        try {
            // 1. Data Migration from LocalStorage (if exists)
            await this._migrateFromLocalStorage();

            // 2. Load all data into cache
            this.cache.hallazgos = await this.db.hallazgos.toArray();
            this.cache.fragmentos = await this.db.fragmentos.toArray();
            this.cache.routes = await this.db.routes.toArray();
            this.cache.documents = await this.db.documents.toArray();

            this.initialized = true;
            console.log('Store initialized with Dexie');
        } catch (e) {
            console.error('Failed to initialize Store:', e);
            // Fallback to empty cache if DB failed
        }
    }

    async _migrateFromLocalStorage() {
        const keys = {
            hallazgos: this.STORAGE_KEY_HALLAZGOS,
            fragmentos: this.STORAGE_KEY_FRAGMENTOS,
            routes: this.STORAGE_KEY_ROUTES,
            documents: this.STORAGE_KEY_DOCUMENTS,
            astillas: 'paleo_astillas' // Legacy
        };

        for (const [table, lsKey] of Object.entries(keys)) {
            const data = localStorage.getItem(lsKey);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        console.log(`Migrating ${table} from LocalStorage...`);
                        const targetTable = table === 'astillas' ? 'fragmentos' : table;

                        // Bulk add to Dexie, ignore duplicates
                        for (const item of parsed) {
                            await this.db[targetTable].put(item);
                        }
                    }
                    // Clear from LocalStorage once migrated
                    localStorage.removeItem(lsKey);
                } catch (e) {
                    console.error(`Error migrating ${table}:`, e);
                }
            }
        }
    }

    // Ensures we are ready before trying to use data (for async calls)
    async ready() {
        return this.initPromise;
    }

    // --- Helpers ---
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // --- Sync getters (return from cache) ---
    getHallazgos() { return this.cache.hallazgos; }
    getFragmentos() { return this.cache.fragmentos; }
    getRoutes() { return this.cache.routes; }
    getDocuments() { return this.cache.documents; }

    // --- Setters (Update cache and Async save to DB) ---
    async addHallazgo(hallazgo) {
        hallazgo.id = this._generateId();
        hallazgo.timestamp = new Date().toISOString();
        this.cache.hallazgos.push(hallazgo);
        await this.db.hallazgos.put(hallazgo);
        return hallazgo;
    }

    async updateHallazgo(id, updatedData) {
        const index = this.cache.hallazgos.findIndex(h => h.id === id);
        if (index !== -1) {
            this.cache.hallazgos[index] = { ...this.cache.hallazgos[index], ...updatedData };
            await this.db.hallazgos.put(this.cache.hallazgos[index]);
            return this.cache.hallazgos[index];
        }
        return null;
    }

    async deleteHallazgo(id) {
        this.cache.hallazgos = this.cache.hallazgos.filter(h => h.id !== id);
        await this.db.hallazgos.delete(id);
    }

    async addFragmento(fragmento) {
        fragmento.id = this._generateId();
        fragmento.timestamp = new Date().toISOString();
        this.cache.fragmentos.push(fragmento);
        await this.db.fragmentos.put(fragmento);
        return fragmento;
    }

    async updateFragmento(id, updatedData) {
        const index = this.cache.fragmentos.findIndex(a => a.id === id);
        if (index !== -1) {
            this.cache.fragmentos[index] = { ...this.cache.fragmentos[index], ...updatedData };
            await this.db.fragmentos.put(this.cache.fragmentos[index]);
            return this.cache.fragmentos[index];
        }
        return null;
    }

    async deleteFragmento(id) {
        this.cache.fragmentos = this.cache.fragmentos.filter(a => a.id !== id);
        await this.db.fragmentos.delete(id);
    }

    async addRoute(route) {
        route.id = this._generateId();
        route.timestamp = new Date().toISOString();
        if (!route.color) route.color = '#FF5722';
        this.cache.routes.push(route);
        await this.db.routes.put(route);
        return route;
    }

    async deleteRoute(id) {
        this.cache.routes = this.cache.routes.filter(r => r.id !== id);
        await this.db.routes.delete(id);
    }

    async addDocument(doc) {
        doc.id = this._generateId();
        doc.timestamp = new Date().toISOString();
        this.cache.documents.push(doc);
        await this.db.documents.put(doc);
        return doc;
    }

    async deleteDocument(id) {
        this.cache.documents = this.cache.documents.filter(d => d.id !== id);
        await this.db.documents.delete(id);
    }

    // --- Folders ---
    getFolders() {
        const folders = new Set();
        this.cache.hallazgos.forEach(h => { if (h.folder) folders.add(h.folder); });
        this.cache.fragmentos.forEach(a => { if (a.folder) folders.add(a.folder); });
        return Array.from(folders).sort();
    }

    // --- Export ---
    getAllDataForExport() {
        return {
            hallazgos: this.cache.hallazgos,
            fragmentos: this.cache.fragmentos,
            routes: this.cache.routes,
            documents: this.cache.documents
        };
    }

    // --- Import JSON ---
    async importData(jsonData) {
        let addedCount = 0;
        let skippedCount = 0;

        const processTable = async (dataArray, table) => {
            if (!Array.isArray(dataArray)) return;
            for (const item of dataArray) {
                const exists = await this.db[table].get(item.id);
                if (!exists) {
                    await this.db[table].put(item);
                    addedCount++;
                } else {
                    skippedCount++;
                }
            }
        };

        if (jsonData.hallazgos) await processTable(jsonData.hallazgos, 'hallazgos');
        if (jsonData.fragmentos) await processTable(jsonData.fragmentos, 'fragmentos');
        if (jsonData.astillas) await processTable(jsonData.astillas, 'fragmentos');
        if (jsonData.routes) await processTable(jsonData.routes, 'routes');
        if (jsonData.documents) await processTable(jsonData.documents, 'documents');

        // Reload cache
        await this._init();
        return { added: addedCount, skipped: skippedCount };
    }

    // --- Utility: Process File ---
    async processFile(file) {
        if (!file) return null;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;
                if (file.type.startsWith('image/')) {
                    const compressed = await this.compressImage(base64);
                    resolve({ type: 'image', data: compressed });
                } else if (file.type === 'application/pdf') {
                    resolve({ type: 'pdf', data: base64 });
                } else {
                    resolve({ type: 'unknown', data: base64 });
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    async compressImage(base64String) {
        if (!base64String || !base64String.startsWith('data:image')) return base64String;
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > this.MAX_IMAGE_DIMENSION || height > this.MAX_IMAGE_DIMENSION) {
                    if (width > height) {
                        height = Math.round((height * this.MAX_IMAGE_DIMENSION) / width);
                        width = this.MAX_IMAGE_DIMENSION;
                    } else {
                        width = Math.round((width * this.MAX_IMAGE_DIMENSION) / height);
                        height = this.MAX_IMAGE_DIMENSION;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', this.IMAGE_QUALITY));
            };
            img.onerror = () => resolve(base64String);
            img.src = base64String;
        });
    }

    // ==================== BACKEND SYNCHRONIZATION ====================

    setCollectorName(name) {
        this.collectorName = name;
        localStorage.setItem('collector_name', name);
    }

    setBackendUrl(url) {
        this.BACKEND_URL = url;
        localStorage.setItem('backend_url', url);
    }

    getCollectorInfo() {
        return {
            id: this.collectorId,
            name: this.collectorName,
            backendUrl: this.BACKEND_URL
        };
    }

    // Sincronizar hallazgo con backend
    async syncHallazgo(hallazgo) {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/collector/hallazgos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectorId: this.collectorId,
                    collectorName: this.collectorName,
                    ...hallazgo
                })
            });

            if (response.ok) {
                // Marcar como sincronizado
                await this.updateHallazgo(hallazgo.id, { synced: true });
                return { success: true };
            } else {
                return { success: false, error: 'Error en servidor' };
            }
        } catch (error) {
            console.error('Error al sincronizar hallazgo:', error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar fragmento con backend
    async syncFragmento(fragmento) {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/collector/fragmentos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectorId: this.collectorId,
                    collectorName: this.collectorName,
                    ...fragmento
                })
            });

            if (response.ok) {
                await this.updateFragmento(fragmento.id, { synced: true });
                return { success: true };
            } else {
                return { success: false, error: 'Error en servidor' };
            }
        } catch (error) {
            console.error('Error al sincronizar fragmento:', error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar ruta con backend
    async syncRoute(route) {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/collector/routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectorId: this.collectorId,
                    collectorName: this.collectorName,
                    name: route.name,
                    content: route.content
                })
            });

            if (response.ok) {
                // Marcar como sincronizado en cache
                const index = this.cache.routes.findIndex(r => r.id === route.id);
                if (index !== -1) {
                    this.cache.routes[index].synced = true;
                    await this.db.routes.put(this.cache.routes[index]);
                }
                return { success: true };
            } else {
                return { success: false, error: 'Error en servidor' };
            }
        } catch (error) {
            console.error('Error al sincronizar ruta:', error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar documento con backend
    async syncDocument(document) {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/collector/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectorId: this.collectorId,
                    collectorName: this.collectorName,
                    title: document.title,
                    category: document.category,
                    file: document.file
                })
            });

            if (response.ok) {
                const index = this.cache.documents.findIndex(d => d.id === document.id);
                if (index !== -1) {
                    this.cache.documents[index].synced = true;
                    await this.db.documents.put(this.cache.documents[index]);
                }
                return { success: true };
            } else {
                return { success: false, error: 'Error en servidor' };
            }
        } catch (error) {
            console.error('Error al sincronizar documento:', error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar todos los datos pendientes
    async syncAll() {
        // CRITICAL FIX: Reload cache from IndexedDB before syncing
        // This ensures newly created items are included in sync
        try {
            this.cache.hallazgos = await this.db.hallazgos.toArray();
            this.cache.fragmentos = await this.db.fragmentos.toArray();
            this.cache.routes = await this.db.routes.toArray();
            this.cache.documents = await this.db.documents.toArray();
        } catch (e) {
            console.error('Error reloading cache before sync:', e);
        }

        const results = {
            hallazgos: { synced: 0, failed: 0 },
            fragmentos: { synced: 0, failed: 0 },
            routes: { synced: 0, failed: 0 },
            documents: { synced: 0, failed: 0 }
        };

        // Sincronizar hallazgos pendientes
        const pendingHallazgos = this.cache.hallazgos.filter(h => !h.synced);
        for (const hallazgo of pendingHallazgos) {
            const result = await this.syncHallazgo(hallazgo);
            if (result.success) results.hallazgos.synced++;
            else results.hallazgos.failed++;
        }

        // Sincronizar fragmentos pendientes
        const pendingFragmentos = this.cache.fragmentos.filter(f => !f.synced);
        for (const fragmento of pendingFragmentos) {
            const result = await this.syncFragmento(fragmento);
            if (result.success) results.fragmentos.synced++;
            else results.fragmentos.failed++;
        }

        // Sincronizar rutas pendientes
        const pendingRoutes = this.cache.routes.filter(r => !r.synced);
        for (const route of pendingRoutes) {
            const result = await this.syncRoute(route);
            if (result.success) results.routes.synced++;
            else results.routes.failed++;
        }

        // Sincronizar documentos pendientes
        const pendingDocuments = this.cache.documents.filter(d => !d.synced);
        for (const document of pendingDocuments) {
            const result = await this.syncDocument(document);
            if (result.success) results.documents.synced++;
            else results.documents.failed++;
        }

        return results;
    }

    // Obtener documentos compartidos del backend
    async fetchSharedDocuments() {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/collector/shared-documents`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Guardar en cache local
                    for (const doc of data.data) {
                        await this.db.sharedDocuments.put(doc);
                    }
                    return data.data;
                }
            }
            return [];
        } catch (error) {
            console.error('Error al obtener documentos compartidos:', error);
            // Retornar documentos locales si hay error
            return await this.db.sharedDocuments.toArray();
        }
    }

    // Obtener documentos compartidos del cache
    async getSharedDocuments() {
        return await this.db.sharedDocuments.toArray();
    }

    // Obtener estadísticas de sincronización
    getSyncStats() {
        const pending = {
            hallazgos: this.cache.hallazgos.filter(h => !h.synced).length,
            fragmentos: this.cache.fragmentos.filter(f => !f.synced).length,
            routes: this.cache.routes.filter(r => !r.synced).length,
            documents: this.cache.documents.filter(d => !d.synced).length
        };

        const total = {
            hallazgos: this.cache.hallazgos.length,
            fragmentos: this.cache.fragmentos.length,
            routes: this.cache.routes.length,
            documents: this.cache.documents.length
        };

        return { pending, total };
    }

    // Verificar conexión con backend
    async checkBackendConnection() {
        try {
            // Use Promise.race for timeout instead of AbortSignal.timeout (not supported in old Android WebView)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 5000);
            });

            const fetchPromise = fetch(`${this.BACKEND_URL}/health`, {
                method: 'GET'
            });

            const response = await Promise.race([fetchPromise, timeoutPromise]);
            return response.ok;
        } catch (error) {
            console.error('Backend connection check failed:', error);
            return false;
        }
    }
}

