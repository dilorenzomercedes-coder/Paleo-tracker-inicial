class UI {
    constructor(store) {
        this.store = store;
        this.currentTab = 'tab-hallazgos';
        this.currentFolder = null;
        this.currentDetailItem = null;
        this.currentDetailType = null;
    }

    init() {
        this.renderHallazgos();
        this.renderAstillas();
        this.updateFolderLists();
        this.renderRoutesList();
    }

    // --- Tabs ---
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.nav-item[data-target="${tabId}"]`).classList.add('active');

        this.currentTab = tabId;
        this.currentFolder = null;

        if (tabId === 'tab-hallazgos') this.renderHallazgos();
        if (tabId === 'tab-astillas') this.renderAstillas();
        if (tabId === 'tab-caminos') this.renderRoutesList();
    }

    // --- Modals ---
    toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    // --- Detail View ---
    showDetail(item, type) {
        this.currentDetailItem = item;
        this.currentDetailType = type;

        const title = document.getElementById('detail-title');
        const content = document.getElementById('detail-content');

        if (type === 'hallazgo') {
            title.textContent = `Hallazgo: ${item.codigo || 'S/N'}`;

            // Generate photos HTML
            let photosHtml = '';
            // Check for modern format (foto1, foto2, foto3) or legacy format (foto)
            const photos = [];
            if (item.foto1) photos.push(item.foto1);
            if (item.foto2) photos.push(item.foto2);
            if (item.foto3) photos.push(item.foto3);
            if (item.foto && !item.foto1) photos.push(item.foto); // Backward compatibility

            if (photos.length > 0) {
                photosHtml = '<div class="detail-row"><div class="detail-label">Fotografías</div><div class="photos-grid">';
                photos.forEach(photo => {
                    photosHtml += `<img src="${photo}" class="detail-photo" alt="Foto del hallazgo">`;
                });
                photosHtml += '</div></div>';
            }

            content.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">Fecha</div>
                    <div class="detail-value">${item.fecha || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Localidad</div>
                    <div class="detail-value">${item.localidad || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Carpeta</div>
                    <div class="detail-value">${item.folder || 'Sin carpeta'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Tipo de Material</div>
                    <div class="detail-value">${item.tipo_material || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Código</div>
                    <div class="detail-value">${item.codigo || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Formación Geológica</div>
                    <div class="detail-value">${item.formacion || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Coordinador</div>
                    <div class="detail-value">Porfiri-Dos Santos</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Colector</div>
                    <div class="detail-value">${item.colector || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Consolidante</div>
                    <div class="detail-value">${item.consolidante || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Acción</div>
                    <div class="detail-value">${item.accion || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Clasificación Taxonómica</div>
                    <div class="detail-value">${item.taxonomia || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Coordenadas GPS</div>
                    <div class="detail-value">${item.lat && item.lng ? `${item.lat}, ${item.lng}` : 'No disponible'}</div>
                </div>
                ${photosHtml}
            `;
        } else if (type === 'astilla') {
            title.textContent = `Astilla - ${item.localidad}`;
            content.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">Fecha</div>
                    <div class="detail-value">${item.fecha || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Localidad</div>
                    <div class="detail-value">${item.localidad || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Carpeta</div>
                    <div class="detail-value">${item.folder || 'Sin carpeta'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Coordenadas GPS</div>
                    <div class="detail-value">${item.lat && item.lng ? `${item.lat}, ${item.lng}` : 'No disponible'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Observaciones</div>
                    <div class="detail-value">${item.observaciones || '-'}</div>
                </div>
                ${item.foto ? `
                <div class="detail-row">
                    <div class="detail-label">Fotografía</div>
                    <img src="${item.foto}" class="detail-photo" alt="Foto de la astilla">
                </div>
                ` : ''}
            `;
        }

        this.toggleModal('detail-modal', true);
    }

    deleteItem() {
        if (!this.currentDetailItem) return;

        if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) return;

        if (this.currentDetailType === 'hallazgo') {
            this.store.deleteHallazgo(this.currentDetailItem.id);
            this.renderHallazgos();
        } else if (this.currentDetailType === 'astilla') {
            this.store.deleteAstilla(this.currentDetailItem.id);
            this.renderAstillas();
        }

        this.toggleModal('detail-modal', false);
        this.currentDetailItem = null;
        this.currentDetailType = null;
    }

    editItem() {
        if (!this.currentDetailItem) return;

        // Close detail modal
        this.toggleModal('detail-modal', false);

        // Open the appropriate form and populate it
        if (this.currentDetailType === 'hallazgo') {
            this.toggleModal('hallazgos-form-container', true);
            this.populateForm('form-hallazgo', this.currentDetailItem);
        } else if (this.currentDetailType === 'astilla') {
            this.toggleModal('astillas-form-container', true);
            this.populateForm('form-astilla', this.currentDetailItem);
        }
    }

    populateForm(formId, data) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Set a flag to indicate we're editing
        form.dataset.editingId = data.id;

        // Populate all fields
        Object.keys(data).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'radio') {
                    const radio = form.querySelector(`[name="${key}"][value="${data[key]}"]`);
                    if (radio) radio.checked = true;
                } else if (input.type !== 'file') {
                    input.value = data[key];
                }
            }
        });

        // Show photo preview if exists
        if (data.foto) {
            const previewId = formId === 'form-hallazgo' ? 'hallazgo-foto-preview' : 'astilla-foto-preview';
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.innerHTML = `<img src="${data.foto}" alt="Preview">`;
            }
        }
    }

    // --- Rendering Logic ---
    _renderList(containerId, items, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (this.currentFolder) {
            const backBtn = document.createElement('div');
            backBtn.className = 'folder-back';
            backBtn.innerHTML = `⬅ Volver a Carpetas (${this.currentFolder})`;
            backBtn.onclick = () => {
                this.currentFolder = null;
                this._renderList(containerId, items, type);
            };
            container.appendChild(backBtn);

            const filteredItems = items.filter(i => i.folder === this.currentFolder);
            if (filteredItems.length === 0) {
                container.innerHTML += '<div class="empty-state">Carpeta vacía.</div>';
            } else {
                filteredItems.forEach(item => {
                    const card = this._createCardElement(item, type);
                    container.appendChild(card);
                });
            }
            return;
        }

        const folders = new Set(items.map(i => i.folder).filter(f => f));

        folders.forEach(folder => {
            const count = items.filter(i => i.folder === folder).length;
            const folderEl = document.createElement('div');
            folderEl.className = 'folder-card';
            folderEl.innerHTML = `
                <span class="folder-icon">📁</span>
                <div class="folder-info">
                    <h4>${folder}</h4>
                    <small>${count} items</small>
                </div>
                <span class="folder-arrow">›</span>
            `;
            folderEl.onclick = () => {
                this.currentFolder = folder;
                this._renderList(containerId, items, type);
            };
            container.appendChild(folderEl);
        });

        const uncategorized = items.filter(i => !i.folder);
        uncategorized.forEach(item => {
            const card = this._createCardElement(item, type);
            container.appendChild(card);
        });

        if (folders.size === 0 && uncategorized.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay registros.</div>';
        }
    }

    _createCardElement(item, type) {
        const card = document.createElement('div');
        card.className = 'data-card';
        card.style.cursor = 'pointer';

        const imgDisplay = item.foto
            ? `<img src="${item.foto}" alt="Foto">`
            : `<div class="img-placeholder"><span>📷</span></div>`;

        const title = type === 'hallazgo' ? `${item.codigo || 'S/N'} - ${item.tipo_material}` : `Astilla - ${item.localidad}`;
        const subtitle = type === 'hallazgo' ? item.taxonomia || 'Sin clasificación' : item.fecha;

        card.innerHTML = `
            ${imgDisplay}
            <div class="data-info">
                <h4>${title}</h4>
                <p>${item.localidad}</p>
                <p>${subtitle}</p>
            </div>
        `;

        card.onclick = () => this.showDetail(item, type);

        return card;
    }

    renderHallazgos() {
        this._renderList('hallazgos-list', this.store.getHallazgos(), 'hallazgo');
    }

    renderAstillas() {
        this._renderList('astillas-list', this.store.getAstillas(), 'astilla');
    }

    renderRoutesList() {
        const routes = this.store.getRoutes();
        const container = document.getElementById('routes-items');
        if (!container) return;

        if (routes.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 20px;">No hay rutas cargadas.</div>';
            return;
        }

        container.innerHTML = '';
        routes.forEach(route => {
            const item = document.createElement('div');
            item.className = 'route-item';

            // Route Info
            const info = document.createElement('div');
            info.style.display = 'flex';
            info.style.flexDirection = 'column';
            info.innerHTML = `
                <span style="font-weight: 500;">${route.name}</span>
                <small style="color: var(--text-muted);">${new Date(route.timestamp).toLocaleDateString()}</small>
            `;

            // Controls
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.alignItems = 'center';
            controls.style.gap = '8px';

            // Color Picker
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = route.color || '#FF5722';
            colorInput.style.width = '30px';
            colorInput.style.height = '30px';
            colorInput.style.padding = '0';
            colorInput.style.border = 'none';
            colorInput.style.background = 'none';
            colorInput.style.cursor = 'pointer';

            colorInput.addEventListener('change', (e) => {
                this.store.updateRoute(route.id, { color: e.target.value });
                // Trigger map refresh if needed, but we need access to mapManager.
                // Since UI doesn't have direct access to mapManager instance easily without passing it or using global event.
                // For now, let's dispatch a custom event or rely on tab switch refresh.
                // Better: Dispatch event.
                document.dispatchEvent(new CustomEvent('route-updated'));
            });

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.className = 'btn-icon';
            deleteBtn.style.color = '#d32f2f';
            deleteBtn.onclick = () => {
                if (confirm(`¿Eliminar la ruta "${route.name}"?`)) {
                    this.store.deleteRoute(route.id);
                    this.renderRoutesList();
                    document.dispatchEvent(new CustomEvent('route-updated'));
                }
            };

            controls.appendChild(colorInput);
            controls.appendChild(deleteBtn);

            item.appendChild(info);
            item.appendChild(controls);
            container.appendChild(item);
        });
    }

    updateFolderLists() {
        const folders = this.store.getFolders();
        const dataList = document.getElementById('folder-list');
        if (dataList) {
            dataList.innerHTML = folders.map(f => `<option value="${f}">`).join('');
        }
    }

    handleImagePreview(input, previewElementId) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById(previewElementId);
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    setRole(role) {
        // Visual toggle handled in app.js via updateRoleUI
    }
}
