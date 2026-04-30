/**
 * PhotoStore — Almacenamiento de fotos en IndexedDB (Dexie.js)
 * Evita el QuotaExceededError de localStorage guardando base64 de fotos en IndexedDB.
 *
 * Uso:
 *   const photoStore = new PhotoStore();
 *   const photoId = await photoStore.savePhoto(base64String);
 *   const base64   = await photoStore.getPhoto(photoId);
 *   await photoStore.deletePhoto(photoId);
 */
class PhotoStore {
    constructor() {
        this.db = null;
        this.ready = this._initDB();
    }

    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PaleoPhotoDB', 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('photos')) {
                    db.createObjectStore('photos', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('PhotoStore: Error opening IndexedDB', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async _getDB() {
        if (!this.db) await this.ready;
        return this.db;
    }

    /**
     * Guarda una foto (base64) en IndexedDB y devuelve su ID único.
     * @param {string} base64 - Cadena data:image/...;base64,...
     * @returns {Promise<string>} ID de la foto guardada
     */
    async savePhoto(base64) {
        const db = await this._getDB();
        const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        return new Promise((resolve, reject) => {
            const tx = db.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');
            store.put({ id, data: base64 });

            tx.oncomplete = () => resolve(id);
            tx.onerror = (e) => {
                console.error('PhotoStore: Error saving photo', e.target.error);
                reject(e.target.error);
            };
        });
    }

    /**
     * Recupera una foto por su ID.
     * @param {string} id
     * @returns {Promise<string|null>} base64 o null si no existe
     */
    async getPhoto(id) {
        if (!id) return null;
        // Si ya viene como base64 (datos viejos), devolver directo
        if (id.startsWith('data:')) return id;

        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const req = store.get(id);

            req.onsuccess = () => resolve(req.result ? req.result.data : null);
            req.onerror = (e) => {
                console.error('PhotoStore: Error getting photo', e.target.error);
                resolve(null);
            };
        });
    }

    /**
     * Elimina una foto por su ID.
     */
    async deletePhoto(id) {
        if (!id || id.startsWith('data:')) return;
        const db = await this._getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('photos', 'readwrite');
            tx.objectStore('photos').delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve(); // Silencioso
        });
    }

    /**
     * Migra fotos base64 viejas desde localStorage a IndexedDB.
     * Llama esto una vez al iniciar la app.
     */
    async migrateFromLocalStorage() {
        const keysToMigrate = ['paleo_hallazgos', 'paleo_fragmentos', 'paleo_rescates', 'partes_diarios_local'];
        const photoFields = ['foto', 'foto1', 'foto2', 'foto3'];
        let migrated = 0;

        for (const key of keysToMigrate) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;

            try {
                const items = JSON.parse(raw);
                if (!Array.isArray(items)) continue;

                let changed = false;
                for (const item of items) {
                    for (const field of photoFields) {
                        const val = item[field];
                        // Si tiene datos base64 (no es un ID de photo)
                        if (val && typeof val === 'string' && val.startsWith('data:image')) {
                            const photoId = await this.savePhoto(val);
                            item[field] = photoId;
                            changed = true;
                            migrated++;
                        }
                    }
                }

                if (changed) {
                    localStorage.setItem(key, JSON.stringify(items));
                }
            } catch (e) {
                console.warn(`PhotoStore: Error migrando ${key}`, e);
            }
        }

        if (migrated > 0) {
            console.log(`✅ PhotoStore: ${migrated} fotos migradas de localStorage a IndexedDB`);
        }
        return migrated;
    }
}

// Instancia global disponible para toda la app
window.photoStore = new PhotoStore();
