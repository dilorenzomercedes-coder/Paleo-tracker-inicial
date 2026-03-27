// sync-manager.js - Gestión de sincronización con backend

class SyncManager {
    constructor(store) {
        this.store = store;
        this.syncInterval = null;
        this.AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos
        console.log('SyncManager constructor called');
    }

    // Iniciar sincronización automática
    startAutoSync() {
        console.log('startAutoSync called');
        this.stopAutoSync(); // Detener si ya existe

        // Sincronizar inmediatamente
        this.syncNow();

        // Configurar intervalo
        this.syncInterval = setInterval(() => {
            this.syncNow();
        }, this.AUTO_SYNC_INTERVAL);

        console.log('Auto-sync iniciado (cada 5 minutos)');
    }

    // Detener sincronización automática
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Sincronizar ahora
    async syncNow() {
        this.updateSyncStatus('syncing', 'Sincronizando...');

        try {
            // Verificar conexión (no bloqueante)
            const isOnline = await this.store.checkBackendConnection();

            if (!isOnline) {
                // Contar items pendientes
                const stats = this.store.getSyncStats();
                const totalPending = stats.pending.hallazgos + stats.pending.fragmentos +
                    stats.pending.routes + stats.pending.documents + (stats.pending.partes || 0);

                if (totalPending === 0) {
                    // No hay nada que sincronizar
                    this.updateSyncStatus('offline', 'Sin conexión (sin datos pendientes)');
                    return { success: true, message: 'No hay datos para sincronizar' };
                } else {
                    // Hay datos pendientes pero sin conexión
                    this.updateSyncStatus('offline', `${totalPending} pendientes (sin conexión)`);
                    return { success: false, error: 'Sin conexión - datos guardados localmente' };
                }
            }

            // Sincronizar todos los datos pendientes
            const results = await this.store.syncAll();

            const totalSynced =
                (results.hallazgos?.synced || 0) +
                (results.fragmentos?.synced || 0) +
                (results.routes?.synced || 0) +
                (results.documents?.synced || 0) +
                (results.partes?.synced || 0);

            const totalFailed =
                (results.hallazgos?.failed || 0) +
                (results.fragmentos?.failed || 0) +
                (results.routes?.failed || 0) +
                (results.documents?.failed || 0) +
                (results.partes?.failed || 0);

            if (totalFailed > 0) {
                this.updateSyncStatus('error', `${totalFailed} errores`);
                return { success: false, results, totalSynced, totalFailed };
            } else if (totalSynced > 0) {
                this.updateSyncStatus('success', `${totalSynced} sincronizados`);
                setTimeout(() => this.updateSyncStatus('idle', 'Todo sincronizado'), 3000);
                return { success: true, results, totalSynced, totalFailed };
            } else {
                this.updateSyncStatus('idle', 'Todo sincronizado');
                return { success: true, results, totalSynced: 0, totalFailed: 0 };
            }
        } catch (error) {
            console.error('Error en sincronización:', error);
            this.updateSyncStatus('offline', 'Modo offline - datos locales');
            return { success: false, error: error.message };
        }
    }

    // Actualizar UI de estado de sincronización
    updateSyncStatus(status, text) {
        const iconEl = document.getElementById('sync-icon');
        const textEl = document.getElementById('sync-text');

        if (!iconEl || !textEl) return;

        const icons = {
            idle: '✅',
            syncing: '🔄',
            success: '✅',
            error: '❌',
            offline: '📵'
        };

        iconEl.textContent = icons[status] || '⏳';
        textEl.textContent = text;

        // Animación de rotación para syncing
        if (status === 'syncing') {
            iconEl.style.animation = 'spin 1s linear infinite';
        } else {
            iconEl.style.animation = 'none';
        }
    }

    // Obtener estadísticas de sincronización
    getSyncStats() {
        return this.store.getSyncStats();
    }

    // Sincronizar documentos compartidos
    async syncSharedDocuments() {
        try {
            const docs = await this.store.fetchSharedDocuments();
            console.log(`${docs.length} documentos compartidos sincronizados`);
            return docs;
        } catch (error) {
            console.error('Error al sincronizar documentos compartidos:', error);
            return [];
        }
    }
}
