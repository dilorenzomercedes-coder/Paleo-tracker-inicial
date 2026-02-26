class Store {
    constructor() {
        this.STORAGE_KEY_HALLAZGOS = 'paleo_hallazgos';
        this.STORAGE_KEY_FRAGMENTOS = 'paleo_fragmentos';
        this.STORAGE_KEY_ROUTES = 'paleo_routes';
        this.STORAGE_KEY_DOCUMENTS = 'paleo_documents';
        // Max image dimension for compression
        this.MAX_IMAGE_DIMENSION = 800;
        this.IMAGE_QUALITY = 0.6;

        // Migration: Check for old "astillas" data and move it to "fragmentos"
        const oldAstillas = localStorage.getItem('paleo_astillas');
        const newFragmentos = localStorage.getItem(this.STORAGE_KEY_FRAGMENTOS);

        if (oldAstillas && !newFragmentos) {
            console.log('Migrating Astillas to Fragmentos...');
            // CRITICAL FIX: "Move" strategy to avoid QuotaExceededError
            try {
                localStorage.removeItem('paleo_astillas'); // Free space first
                localStorage.setItem(this.STORAGE_KEY_FRAGMENTOS, oldAstillas); // Write new
                console.log("Migration successful (Moved).");
            } catch (e) {
                console.error("Migration failed:", e);
                alert("Error crítico: No hay espacio para migrar los datos. Haz backup urgente.");
                // Emergency rollback (though likely to fail if full)
                try { localStorage.setItem('paleo_astillas', oldAstillas); } catch (i) { }
            }
        }
    }

    // --- Helpers ---
    _getData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    _saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('⚠️ Sin espacio de almacenamiento.\n\nLas fotos ocupan mucho espacio. Intenta:\n1. Eliminar registros antiguos\n2. Hacer un backup y limpiar datos\n3. Usar fotos más pequeñas');
                console.error('QuotaExceededError: Storage is full');
            } else {
                alert('Error al guardar: ' + e.message);
                console.error('Save error:', e);
            }
            return false;
        }
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Compress image before storing
    async compressImage(base64String) {
        if (!base64String || !base64String.startsWith('data:image')) {
            return base64String;
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down if larger than max dimension
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

                // Convert to JPEG with compression
                const compressed = canvas.toDataURL('image/jpeg', this.IMAGE_QUALITY);
                resolve(compressed);
            };
            img.onerror = () => {
                resolve(base64String); // Return original if compression fails
            };
            img.src = base64String;
        });
    }

    // Process file (Image compress, PDF check)
    async processFile(file) {
        if (!file) return null;

        return new Promise((resolve, reject) => {
            // Check size (warn if > 3MB)
            if (file.size > 3 * 1024 * 1024) {
                alert('⚠️ El archivo es grande (>3MB). Podría ralentizar la app.');
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;
                if (file.type.startsWith('image/')) {
                    // Compress if image
                    const compressed = await this.compressImage(base64);
                    resolve({ type: 'image', data: compressed });
                } else if (file.type === 'application/pdf') {
                    // Return raw base64 for PDF
                    resolve({ type: 'pdf', data: base64 });
                } else {
                    // Fallback
                    resolve({ type: 'unknown', data: base64 });
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    // --- Hallazgos ---
    getHallazgos() {
        return this._getData(this.STORAGE_KEY_HALLAZGOS);
    }

    addHallazgo(hallazgo) {
        const list = this.getHallazgos();
        hallazgo.id = this._generateId();
        hallazgo.timestamp = new Date().toISOString();
        list.push(hallazgo);
        this._saveData(this.STORAGE_KEY_HALLAZGOS, list);
        return hallazgo;
    }

    updateHallazgo(id, updatedData) {
        const list = this.getHallazgos();
        const index = list.findIndex(h => h.id === id);
        if (index !== -1) {
            list[index] = { ...list[index], ...updatedData };
            this._saveData(this.STORAGE_KEY_HALLAZGOS, list);
            return list[index];
        }
        return null;
    }

    deleteHallazgo(id) {
        const list = this.getHallazgos();
        const filtered = list.filter(h => h.id !== id);
        this._saveData(this.STORAGE_KEY_HALLAZGOS, filtered);
    }

    // --- Fragmentos (antes Astillas) ---
    getFragmentos() {
        return this._getData(this.STORAGE_KEY_FRAGMENTOS);
    }

    addFragmento(fragmento) {
        const list = this.getFragmentos();
        fragmento.id = this._generateId();
        fragmento.timestamp = new Date().toISOString();
        list.push(fragmento);
        this._saveData(this.STORAGE_KEY_FRAGMENTOS, list);
        return fragmento;
    }

    updateFragmento(id, updatedData) {
        const list = this.getFragmentos();
        const index = list.findIndex(a => a.id === id);
        if (index !== -1) {
            list[index] = { ...list[index], ...updatedData };
            this._saveData(this.STORAGE_KEY_FRAGMENTOS, list);
            return list[index];
        }
        return null;
    }

    deleteFragmento(id) {
        const list = this.getFragmentos();
        const filtered = list.filter(a => a.id !== id);
        this._saveData(this.STORAGE_KEY_FRAGMENTOS, filtered);
    }

    // --- Routes (Caminos) ---
    getRoutes() {
        return this._getData(this.STORAGE_KEY_ROUTES);
    }

    addRoute(route) {
        const list = this.getRoutes();
        route.id = this._generateId();
        route.timestamp = new Date().toISOString();
        // Default color if not present
        if (!route.color) route.color = '#FF5722';
        list.push(route);
        this._saveData(this.STORAGE_KEY_ROUTES, list);
        return route;
    }

    updateRoute(id, updatedData) {
        const list = this.getRoutes();
        const index = list.findIndex(r => r.id === id);
        if (index !== -1) {
            list[index] = { ...list[index], ...updatedData };
            this._saveData(this.STORAGE_KEY_ROUTES, list);
            return list[index];
        }
        return null;
    }

    deleteRoute(id) {
        const list = this.getRoutes();
        const filtered = list.filter(r => r.id !== id);
        this._saveData(this.STORAGE_KEY_ROUTES, filtered);
    }

    // --- Documents ---
    getDocuments() {
        return this._getData(this.STORAGE_KEY_DOCUMENTS);
    }

    addDocument(doc) {
        const list = this.getDocuments();
        doc.id = this._generateId();
        doc.timestamp = new Date().toISOString();
        list.push(doc);
        this._saveData(this.STORAGE_KEY_DOCUMENTS, list);
        return doc;
    }

    deleteDocument(id) {
        const list = this.getDocuments();
        const filtered = list.filter(d => d.id !== id);
        this._saveData(this.STORAGE_KEY_DOCUMENTS, filtered);
    }

    // --- Folders ---
    getFolders() {
        const hallazgos = this.getHallazgos();
        const fragmentos = this.getFragmentos();
        const folders = new Set();

        hallazgos.forEach(h => { if (h.folder) folders.add(h.folder); });
        fragmentos.forEach(a => { if (a.folder) folders.add(a.folder); });

        return Array.from(folders).sort();
    }

    // --- Export ---
    getAllDataForExport() {
        return {
            hallazgos: this.getHallazgos(),
            fragmentos: this.getFragmentos(),
            routes: this.getRoutes()
        };
    }
    // --- Import/Export JSON ---
    importData(jsonData) {
        let addedCount = 0;
        let skippedCount = 0;

        const processItem = (item, list, saveKey) => {
            // Check if item with same ID exists
            const exists = list.some(existing => existing.id === item.id);
            if (!exists) {
                list.push(item);
                addedCount++;
                return true;
            } else {
                skippedCount++;
                return false;
            }
        };

        if (jsonData.hallazgos && Array.isArray(jsonData.hallazgos)) {
            const list = this.getHallazgos();
            let changed = false;
            jsonData.hallazgos.forEach(item => {
                if (processItem(item, list)) changed = true;
            });
            if (changed) this._saveData(this.STORAGE_KEY_HALLAZGOS, list);
        }

        if (jsonData.fragmentos && Array.isArray(jsonData.fragmentos)) {
            const list = this.getFragmentos();
            let changed = false;
            jsonData.fragmentos.forEach(item => {
                if (processItem(item, list)) changed = true;
            });
            if (changed) this._saveData(this.STORAGE_KEY_FRAGMENTOS, list);
        }

        // Backward compatibility for import
        if (jsonData.astillas && Array.isArray(jsonData.astillas)) {
            const list = this.getFragmentos();
            let changed = false;
            jsonData.astillas.forEach(item => {
                if (processItem(item, list)) changed = true;
            });
            if (changed) this._saveData(this.STORAGE_KEY_FRAGMENTOS, list);
        }

        if (jsonData.routes && Array.isArray(jsonData.routes)) {
            const list = this.getRoutes();
            let changed = false;
            jsonData.routes.forEach(item => {
                if (processItem(item, list)) changed = true;
            });
            if (changed) this._saveData(this.STORAGE_KEY_ROUTES, list);
        }

        return { added: addedCount, skipped: skippedCount };
    }
}
