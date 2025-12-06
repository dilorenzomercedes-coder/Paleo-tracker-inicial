class Store {
    constructor() {
        this.STORAGE_KEY_HALLAZGOS = 'paleo_hallazgos';
        this.STORAGE_KEY_ASTILLAS = 'paleo_astillas';
        this.STORAGE_KEY_ROUTES = 'paleo_routes';
    }

    // --- Helpers ---
    _getData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    _saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

    // --- Astillas ---
    getAstillas() {
        return this._getData(this.STORAGE_KEY_ASTILLAS);
    }

    addAstilla(astilla) {
        const list = this.getAstillas();
        astilla.id = this._generateId();
        astilla.timestamp = new Date().toISOString();
        list.push(astilla);
        this._saveData(this.STORAGE_KEY_ASTILLAS, list);
        return astilla;
    }

    updateAstilla(id, updatedData) {
        const list = this.getAstillas();
        const index = list.findIndex(a => a.id === id);
        if (index !== -1) {
            list[index] = { ...list[index], ...updatedData };
            this._saveData(this.STORAGE_KEY_ASTILLAS, list);
            return list[index];
        }
        return null;
    }

    deleteAstilla(id) {
        const list = this.getAstillas();
        const filtered = list.filter(a => a.id !== id);
        this._saveData(this.STORAGE_KEY_ASTILLAS, filtered);
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

    // --- Folders ---
    getFolders() {
        const hallazgos = this.getHallazgos();
        const astillas = this.getAstillas();
        const folders = new Set();

        hallazgos.forEach(h => { if (h.folder) folders.add(h.folder); });
        astillas.forEach(a => { if (a.folder) folders.add(a.folder); });

        return Array.from(folders).sort();
    }

    // --- Export ---
    getAllDataForExport() {
        return {
            hallazgos: this.getHallazgos(),
            astillas: this.getAstillas(),
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

        if (jsonData.astillas && Array.isArray(jsonData.astillas)) {
            const list = this.getAstillas();
            let changed = false;
            jsonData.astillas.forEach(item => {
                if (processItem(item, list)) changed = true;
            });
            if (changed) this._saveData(this.STORAGE_KEY_ASTILLAS, list);
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
