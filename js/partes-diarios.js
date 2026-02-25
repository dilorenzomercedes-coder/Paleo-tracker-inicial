// Partes Diarios Manager
// Handles daily report photo storage and display in the Documentación tab

class PartesDiariosManager {
    constructor() {
        this.DB_KEY = 'partes_diarios';
        this.init();
    }

    // ─── LocalStorage helpers ────────────────────────────────────────
    getPartes() {
        try {
            return JSON.parse(localStorage.getItem(this.DB_KEY) || '[]');
        } catch {
            return [];
        }
    }

    savePartes(partes) {
        localStorage.setItem(this.DB_KEY, JSON.stringify(partes));
    }

    addParte(parte) {
        const partes = this.getPartes();
        parte.id = Date.now().toString();
        parte.createdAt = new Date().toISOString();
        parte.collectorId = localStorage.getItem('collector_id') || 'unknown';
        parte.collectorName = localStorage.getItem('collector_name') || '';
        parte.syncStatus = 'pending';
        partes.unshift(parte); // newest first
        this.savePartes(partes);
        return parte;
    }

    deleteParte(id) {
        const partes = this.getPartes().filter(p => p.id !== id);
        this.savePartes(partes);
    }

    // ─── UI ─────────────────────────────────────────────────────────
    init() {
        // Floating button opens modal
        document.getElementById('btn-nuevo-parte')?.addEventListener('click', () => {
            this.openModal();
        });

        // Close modal
        document.getElementById('btn-close-parte')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Photo preview
        document.getElementById('parte-foto-input')?.addEventListener('change', (e) => {
            this.showPhotoPreview(e.target.files[0]);
        });

        // Form submit
        document.getElementById('form-parte-diario')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveParte(e.target);
        });

        // Export button
        document.getElementById('btn-exportar-partes')?.addEventListener('click', () => {
            this.exportarPartes();
        });

        // Initial render
        this.renderPartes();
    }

    exportarPartes() {
        const partes = this.getPartes();
        if (partes.length === 0) {
            alert('No hay partes diarios para exportar.');
            return;
        }

        const json = JSON.stringify(partes, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const fecha = new Date().toISOString().split('T')[0];
        const collectorName = (localStorage.getItem('collector_name') || 'colector').replace(/\s+/g, '_');

        const a = document.createElement('a');
        a.href = url;
        a.download = `partes_diarios_${collectorName}_${fecha}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }


    openModal() {
        const modal = document.getElementById('parte-diario-modal');
        const fechaInput = document.getElementById('parte-fecha');
        // Default to today
        fechaInput.value = new Date().toISOString().split('T')[0];
        document.getElementById('form-parte-diario').reset();
        fechaInput.value = new Date().toISOString().split('T')[0];
        document.getElementById('parte-foto-preview').innerHTML = '';
        modal.classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('parte-diario-modal').classList.add('hidden');
    }

    showPhotoPreview(file) {
        if (!file) return;
        const preview = document.getElementById('parte-foto-preview');
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:100%; border-radius:8px; margin-top:8px;">`;
        };
        reader.readAsDataURL(file);
    }

    async saveParte(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        try {
            const fecha = form.querySelector('[name="fecha"]').value;
            const observaciones = form.querySelector('[name="observaciones"]').value;
            const fotoInput = form.querySelector('[name="foto"]');

            if (!fotoInput.files[0]) {
                alert('Por favor, seleccioná o tomá una foto del parte.');
                return;
            }

            const fotoData = await this.readFileAsDataURL(fotoInput.files[0]);

            this.addParte({ fecha, observaciones, fotoData });
            this.closeModal();
            this.renderPartes();
        } catch (err) {
            console.error('Error guardando parte:', err);
            alert('Error al guardar el parte. Intentá de nuevo.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '💾 Guardar Parte Diario';
        }
    }

    renderPartes() {
        const container = document.getElementById('partes-diarios-list');
        const countEl = document.getElementById('count-partes');
        if (!container) return;

        const partes = this.getPartes();
        if (countEl) countEl.textContent = `${partes.length} parte${partes.length !== 1 ? 's' : ''}`;

        if (partes.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay partes diarios registrados.</div>';
            return;
        }

        container.innerHTML = '';
        partes.forEach(parte => {
            const card = document.createElement('div');
            card.className = 'data-card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <div style="width:60px;height:60px;border-radius:8px;overflow:hidden;flex-shrink:0;background:#eee;">
                    <img src="${parte.fotoData}" alt="Parte" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div class="data-info">
                    <h4>📋 Parte del ${this.formatDate(parte.fecha)}</h4>
                    <small>${parte.observaciones ? parte.observaciones.substring(0, 60) + (parte.observaciones.length > 60 ? '...' : '') : 'Sin observaciones'}</small>
                    <small style="display:block;color:var(--text-muted);margin-top:4px;">${parte.collectorName || parte.collectorId}</small>
                </div>
                <button class="btn-danger btn-small" data-id="${parte.id}" style="flex-shrink:0;padding:6px 10px;font-size:0.8rem;">🗑️</button>
            `;
            // View on card click (not delete)
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.viewParte(parte);
            });
            // Delete button
            card.querySelector('button[data-id]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('¿Eliminar este parte diario?')) {
                    this.deleteParte(parte.id);
                    this.renderPartes();
                }
            });
            container.appendChild(card);
        });
    }

    viewParte(parte) {
        // Reuse the detail-modal from existing UI
        const modal = document.getElementById('detail-modal');
        if (!modal) return;

        document.getElementById('detail-title').textContent = `📋 Parte del ${this.formatDate(parte.fecha)}`;
        document.getElementById('detail-content').innerHTML = `
            <div style="text-align:center; margin-bottom:16px;">
                <img src="${parte.fotoData}" alt="Parte Diario" style="max-width:100%;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
            </div>
            ${parte.observaciones ? `
            <div style="background:#f8f9fa;padding:14px;border-radius:8px;margin-bottom:14px;">
                <strong>Observaciones:</strong>
                <p style="margin:8px 0 0;color:#444;">${parte.observaciones}</p>
            </div>` : ''}
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button id="btn-parte-share" class="btn-secondary" style="flex:1;justify-content:center;">📤 Compartir Foto</button>
            </div>
        `;

        // Hide edit/delete buttons from default modal actions (delete handled inside)
        document.getElementById('btn-delete-item').style.display = 'none';
        document.getElementById('btn-edit-item').style.display = 'none';

        // Share button
        document.getElementById('btn-parte-share').onclick = () => this.shareParte(parte);

        modal.classList.remove('hidden');
    }

    async shareParte(parte) {
        try {
            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const { Filesystem, Share } = window.Capacitor.Plugins;
                const base64 = parte.fotoData.split(',')[1];
                const ext = parte.fotoData.includes('jpeg') ? 'jpg' : 'png';
                const fileName = `parte_${parte.fecha}.${ext}`;
                const result = await Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
                await Share.share({ title: `Parte Diario ${parte.fecha}`, files: [result.uri] });
            } else {
                const link = document.createElement('a');
                link.href = parte.fotoData;
                link.download = `parte_${parte.fecha}.jpg`;
                link.click();
            }
        } catch (e) {
            console.error('Error compartiendo parte:', e);
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return '–';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.partesDiariosManager = new PartesDiariosManager();
});
