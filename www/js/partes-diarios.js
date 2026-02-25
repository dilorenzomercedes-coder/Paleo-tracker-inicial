// Partes Diarios Manager
// Saves partes to backend API (same flow as Hallazgos). Falls back to localStorage if offline.

class PartesDiariosManager {
    constructor() {
        this.LOCAL_KEY = 'partes_diarios_local';   // local copy (own partes, for display)
        this.PENDING_KEY = 'partes_diarios_pending'; // offline queue
        this.BACKEND_URL = localStorage.getItem('backend_url') || 'https://paleo-tracker-backend.onrender.com';
        this.collectorId = localStorage.getItem('collector_id') || 'unknown';
        this.collectorName = localStorage.getItem('collector_name') || '';
        this.init();
    }

    // ─── LocalStorage helpers ────────────────────────────────────────
    getLocalPartes() {
        try { return JSON.parse(localStorage.getItem(this.LOCAL_KEY) || '[]'); } catch { return []; }
    }
    saveLocalPartes(partes) {
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(partes));
    }
    getPending() {
        try { return JSON.parse(localStorage.getItem(this.PENDING_KEY) || '[]'); } catch { return []; }
    }
    savePending(items) {
        localStorage.setItem(this.PENDING_KEY, JSON.stringify(items));
    }

    // ─── UI ─────────────────────────────────────────────────────────
    init() {
        document.getElementById('btn-nuevo-parte')?.addEventListener('click', () => this.openModal());
        document.getElementById('btn-close-parte')?.addEventListener('click', () => this.closeModal());
        document.getElementById('parte-foto-input')?.addEventListener('change', (e) => this.showPhotoPreview(e.target.files[0]));
        document.getElementById('form-parte-diario')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveParte(e.target);
        });
        this.renderPartes();
        // Try to flush any pending offline partes
        this.flushPending();
    }

    openModal() {
        const modal = document.getElementById('parte-diario-modal');
        const fechaInput = document.getElementById('parte-fecha');
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

            const foto = await this.readFileAsDataURL(fotoInput.files[0]);
            const id = `parte_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const parteData = {
                id,
                fecha,
                observaciones,
                foto,
                collectorId: this.collectorId,
                collectorName: this.collectorName
            };

            // Save locally first (always visible to collector)
            const local = this.getLocalPartes();
            local.unshift({ ...parteData, createdAt: new Date().toISOString() });
            this.saveLocalPartes(local);

            // Try to POST to backend
            const sent = await this.postToBackend(parteData);
            if (!sent) {
                // Queue for later sync
                const pending = this.getPending();
                pending.push(parteData);
                this.savePending(pending);
                alert('Parte guardado localmente. Se enviará al servidor cuando haya conexión.');
            } else {
                alert('Parte enviado correctamente.');
            }

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

    async postToBackend(parteData) {
        try {
            const resp = await fetch(`${this.BACKEND_URL}/api/collector/partes-diarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...parteData,
                    collectorId: this.collectorId,
                    collectorName: this.collectorName
                })
            });
            return resp.ok;
        } catch {
            return false;
        }
    }

    async flushPending() {
        const pending = this.getPending();
        if (pending.length === 0) return;

        const remaining = [];
        for (const parte of pending) {
            const sent = await this.postToBackend(parte);
            if (!sent) remaining.push(parte);
        }
        this.savePending(remaining);
        if (remaining.length < pending.length) {
            console.log(`${pending.length - remaining.length} partes pendientes enviados al servidor.`);
        }
    }

    renderPartes() {
        const container = document.getElementById('partes-diarios-list');
        const countEl = document.getElementById('count-partes');
        if (!container) return;

        const partes = this.getLocalPartes();
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
                    <img src="${parte.foto}" alt="Parte" style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div class="data-info">
                    <h4>📋 Parte del ${this.formatDate(parte.fecha)}</h4>
                    <small>${parte.observaciones ? parte.observaciones.substring(0, 60) + (parte.observaciones.length > 60 ? '...' : '') : 'Sin observaciones'}</small>
                </div>
            `;
            card.addEventListener('click', () => this.viewParte(parte));
            container.appendChild(card);
        });
    }

    viewParte(parte) {
        const modal = document.getElementById('detail-modal');
        if (!modal) return;

        document.getElementById('detail-title').textContent = `📋 Parte del ${this.formatDate(parte.fecha)}`;
        document.getElementById('detail-content').innerHTML = `
            <div style="text-align:center; margin-bottom:16px;">
                <img src="${parte.foto}" alt="Parte Diario" style="max-width:100%;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
            </div>
            ${parte.observaciones ? `
            <div style="background:#f8f9fa;padding:14px;border-radius:8px;margin-bottom:14px;">
                <strong>Observaciones:</strong>
                <p style="margin:8px 0 0;color:#444;">${parte.observaciones}</p>
            </div>` : ''}
        `;
        document.getElementById('btn-delete-item').style.display = 'none';
        document.getElementById('btn-edit-item').style.display = 'none';
        modal.classList.remove('hidden');
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
