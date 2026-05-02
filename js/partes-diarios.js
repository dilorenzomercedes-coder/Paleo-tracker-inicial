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

        // Poblar datalists con valores previos
        const partes = this.getLocalPartes();
        const empresas = [...new Set(partes.map(p => p.empresa).filter(Boolean))];
        const yacimientos = [...new Set(partes.map(p => p.yacimiento).filter(Boolean))];
        const locaciones = [...new Set(partes.map(p => p.locacion).filter(Boolean))];
        const dlEmpresas = document.getElementById('parte-empresas-list');
        const dlYacimientos = document.getElementById('parte-yacimientos-list');
        const dlLocaciones = document.getElementById('parte-locaciones-list');
        if (dlEmpresas) dlEmpresas.innerHTML = empresas.map(e => `<option value="${e}">`).join('');
        if (dlYacimientos) dlYacimientos.innerHTML = yacimientos.map(y => `<option value="${y}">`).join('');
        if (dlLocaciones) dlLocaciones.innerHTML = locaciones.map(l => `<option value="${l}">`).join('');

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
            const empresa = form.querySelector('[name="empresa"]')?.value?.trim() || '';
            const yacimiento = form.querySelector('[name="yacimiento"]')?.value?.trim() || '';
            const locacion = form.querySelector('[name="locacion"]')?.value?.trim() || '';
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
                empresa,
                yacimiento,
                locacion,
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
                <div class="data-info" style="flex:1;">
                    <h4>📋 Parte del ${this.formatDate(parte.fecha)}</h4>
                    ${parte.empresa ? `<small style="color:#555;">🏢 ${parte.empresa}${parte.yacimiento ? ' › ⛏️ ' + parte.yacimiento : ''}${parte.locacion ? ' › 📍 ' + parte.locacion : ''}</small><br>` : ''}
                    <small>${parte.observaciones ? parte.observaciones.substring(0, 60) + (parte.observaciones.length > 60 ? '...' : '') : 'Sin observaciones'}</small>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
                    <button class="btn-secondary" style="padding:6px 10px;font-size:0.8rem;" data-action="edit-parte" data-id="${parte.id}">✏️</button>
                    <button class="btn-secondary" style="padding:6px 10px;font-size:0.8rem;color:#e53935;" data-action="delete-parte" data-id="${parte.id}">🗑️</button>
                </div>
            `;
            card.addEventListener('click', () => this.viewParte(parte));
            card.querySelector('[data-action="edit-parte"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.editParte(parte);
            });
            card.querySelector('[data-action="delete-parte"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteParte(parte);
            });
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
            ${parte.empresa ? `<div style="background:#f8f9fa;padding:14px;border-radius:8px;margin-bottom:14px;">
                <strong>🏢 Empresa:</strong> ${parte.empresa}
                ${parte.yacimiento ? `<br><strong>⛏️ Yacimiento:</strong> ${parte.yacimiento}` : ''}
                ${parte.locacion ? `<br><strong>📍 Locación:</strong> ${parte.locacion}` : ''}
            </div>` : ''}
            ${parte.observaciones ? `
            <div style="background:#f8f9fa;padding:14px;border-radius:8px;margin-bottom:14px;">
                <strong>Observaciones:</strong>
                <p style="margin:8px 0 0;color:#444;">${parte.observaciones}</p>
            </div>` : ''}
        `;

        const btnDelete = document.getElementById('btn-delete-item');
        btnDelete.style.display = 'block';
        btnDelete.onclick = () => {
            modal.classList.add('hidden');
            this.deleteParte(parte);
        };

        const btnEdit = document.getElementById('btn-edit-item');
        btnEdit.style.display = 'block';
        btnEdit.onclick = () => {
            modal.classList.add('hidden');
            this.editParte(parte);
        };

        modal.classList.remove('hidden');
    }

    deleteParte(parte) {
        if (!confirm(`¿Eliminar el parte del ${this.formatDate(parte.fecha)}?`)) return;
        const list = this.getLocalPartes();
        const filtered = list.filter(p => p.id !== parte.id);
        this.saveLocalPartes(filtered);
        // También eliminar de pending si estaba ahí
        const pending = this.getPending().filter(p => p.id !== parte.id);
        this.savePending(pending);
        this.renderPartes();
        // Intentar eliminar en backend si hay conexión
        this.deleteFromBackend(parte.id);
    }

    async deleteFromBackend(parteId) {
        try {
            await fetch(`${this.BACKEND_URL}/api/collector/partes-diarios/${parteId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ collectorId: this.collectorId })
            });
        } catch {
            // Silencioso — el dato local ya fue eliminado
        }
    }

    editParte(parte) {
        const modal = document.getElementById('parte-diario-modal');
        if (!modal) return;

        // Abrir modal y poblar con datos existentes
        this.openModal();

        // Poblar campos
        const form = document.getElementById('form-parte-diario');
        form.querySelector('[name="fecha"]').value = parte.fecha || '';
        form.querySelector('[name="empresa"]').value = parte.empresa || '';
        form.querySelector('[name="yacimiento"]').value = parte.yacimiento || '';
        form.querySelector('[name="locacion"]').value = parte.locacion || '';
        form.querySelector('[name="observaciones"]').value = parte.observaciones || '';

        // Mostrar foto actual como preview
        const preview = document.getElementById('parte-foto-preview');
        if (parte.foto) {
            preview.innerHTML = `
                <img src="${parte.foto}" alt="Foto actual" style="max-width:100%; border-radius:8px; margin-top:8px;">
                <small style="color:var(--text-muted);display:block;margin-top:4px;">📷 Foto actual — seleccioná otra para reemplazar</small>
            `;
        }

        // Hacer la foto opcional para edición
        const fotoInput = document.getElementById('parte-foto-input');
        fotoInput.removeAttribute('required');

        // Cambiar título y botón
        const title = modal.querySelector('h3, .modal-title');
        if (title) title.textContent = 'Editar Parte Diario';
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalLabel = submitBtn?.innerHTML;
        if (submitBtn) submitBtn.innerHTML = '💾 Guardar Cambios';

        // Override del submit
        const originalOnSubmit = form.onsubmit;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtnInner = form.querySelector('button[type="submit"]');
            submitBtnInner.disabled = true;
            submitBtnInner.textContent = 'Guardando...';

            try {
                const updatedData = {
                    fecha: form.querySelector('[name="fecha"]').value,
                    empresa: form.querySelector('[name="empresa"]')?.value?.trim() || '',
                    yacimiento: form.querySelector('[name="yacimiento"]')?.value?.trim() || '',
                    locacion: form.querySelector('[name="locacion"]')?.value?.trim() || '',
                    observaciones: form.querySelector('[name="observaciones"]').value,
                };

                // Solo reemplazar foto si seleccionaron una nueva
                const newFotoInput = form.querySelector('[name="foto"]');
                if (newFotoInput.files[0]) {
                    updatedData.foto = await this.readFileAsDataURL(newFotoInput.files[0]);
                }

                // Actualizar en local
                const list = this.getLocalPartes();
                const index = list.findIndex(p => p.id === parte.id);
                if (index !== -1) {
                    list[index] = { ...list[index], ...updatedData };
                    this.saveLocalPartes(list);
                }

                // Intentar actualizar en backend
                this.putToBackend(parte.id, { ...list.find(p => p.id === parte.id) });

                this.closeModal();
                this.renderPartes();
            } catch (err) {
                console.error('Error editando parte:', err);
                alert('Error al guardar los cambios.');
            } finally {
                submitBtnInner.disabled = false;
                // Restaurar estado original del modal para próxima vez
                fotoInput.setAttribute('required', '');
                if (title) title.textContent = 'Nuevo Parte Diario';
                if (submitBtnInner) submitBtnInner.innerHTML = originalLabel;
                form.onsubmit = originalOnSubmit;
            }
        };
    }

    async putToBackend(parteId, parteData) {
        try {
            await fetch(`${this.BACKEND_URL}/api/collector/partes-diarios/${parteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...parteData, collectorId: this.collectorId, collectorName: this.collectorName })
            });
        } catch {
            // Silencioso — el dato local ya fue actualizado
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
