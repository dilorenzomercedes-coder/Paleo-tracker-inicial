class UI {
    constructor(store) {
        this.store = store;
        this.currentTab = 'tab-hallazgos';
        this.currentFolder = null;
        this.currentDetailItem = null;
        this.currentDetailType = null;
        this._activeBlobUrls = [];
    }

    // --- Photo rendering helpers (fix: WebView de Android no renderiza bien data: URIs largas) ---
    _dataURItoBlob(dataURI) {
        if (!dataURI || typeof dataURI !== 'string' || !dataURI.startsWith('data:')) return null;
        try {
            const [header, base64Data] = dataURI.split(',');
            const mimeMatch = header.match(/data:(.*?);base64/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const byteString = atob(base64Data);
            const arrayBuffer = new ArrayBuffer(byteString.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            for (let i = 0; i < byteString.length; i++) {
                uint8Array[i] = byteString.charCodeAt(i);
            }
            return new Blob([uint8Array], { type: mime });
        } catch (e) {
            console.error('Error convirtiendo data URI a Blob:', e);
            return null;
        }
    }

    // Devuelve una Blob URL si es una data URI válida; si no, devuelve el valor original tal cual
    // (por ejemplo IDs viejos de photo-store.js, que quedan como estaban antes)
    _getPhotoSrc(value) {
        const blob = this._dataURItoBlob(value);
        if (!blob) return value || '';
        const url = URL.createObjectURL(blob);
        this._activeBlobUrls.push(url);
        return url;
    }

    // Libera las Blob URLs anteriores antes de generar nuevas, para no acumular memoria
    _revokeBlobUrls() {
        this._activeBlobUrls.forEach(u => URL.revokeObjectURL(u));
        this._activeBlobUrls = [];
    }

    init() {
        this.renderHallazgos();
        this.renderFragmentos();
        this.renderRescates();
        this.updateFolderLists();
        this.renderRoutesList();
        this.renderDocumentFolders();
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
        if (tabId === 'tab-fragmentos') this.renderFragmentos();
        if (tabId === 'tab-rescates') this.renderRescates();
        if (tabId === 'tab-caminos') this.renderRoutesList();
        if (tabId === 'tab-documentacion') this.renderDocumentFolders();
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
        this._revokeBlobUrls();
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
                    photosHtml += `<img src="${this._getPhotoSrc(photo)}" class="detail-photo" alt="Foto del hallazgo">`;
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
        } else if (type === 'fragmento') {
            const TIPO_LABELS = { xilopalo: 'Xilópalo', vertebrados_fosiles: 'Vertebrados Fósiles', invertebrados_fosiles: 'Invertebrados Fósiles', icnofosil: 'Icnofósil' };
            const tipoLabel = TIPO_LABELS[item.tipo_vestigio] || (item.observaciones?.toLowerCase().includes('xilopalo') ? 'Xilópalo' : 'Vertebrados Fósiles');
            title.textContent = `${tipoLabel} - ${item.localidad}`;
            content.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">Tipo</div>
                    <div class="detail-value">${tipoLabel}</div>
                </div>
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
                    <img src="${this._getPhotoSrc(item.foto)}" class="detail-photo" alt="Foto del vestigio">
                </div>
                ` : ''}
            `;
        }

        this.toggleModal('detail-modal', true);
    }

    async deleteItem() {
        if (!this.currentDetailItem) return;

        if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) return;

        if (this.currentDetailType === 'hallazgo') {
            await this.store.deleteHallazgo(this.currentDetailItem.id);
            this.renderHallazgos();
        } else if (this.currentDetailType === 'fragmento') {
            await this.store.deleteFragmento(this.currentDetailItem.id);
            this.renderFragmentos();
        } else if (this.currentDetailType === 'rescate') {
            await this.store.deleteRescate(this.currentDetailItem.id);
            this.renderRescates();
        }

        this.toggleModal('detail-modal', false);
        this.currentDetailItem = null;
        this.currentDetailType = null;
    }

    editItem() {
        if (!this.currentDetailItem) return;

        this.toggleModal('detail-modal', false);

        if (this.currentDetailType === 'hallazgo') {
            this.toggleModal('hallazgos-form-container', true);
            this.populateForm('form-hallazgo', this.currentDetailItem);
        } else if (this.currentDetailType === 'fragmento') {
            this.toggleModal('fragmentos-form-container', true);
            this.populateForm('form-fragmento', this.currentDetailItem);
        } else if (this.currentDetailType === 'rescate') {
            this.toggleModal('rescates-form-container', true);
            this.populateForm('form-rescate', this.currentDetailItem);
        }
    }

    // --- Documents UI ---
    async renderDocumentFolders() {
        const docs = await this.store.getDocuments();
        const categories = ['Permisos', 'ATS', 'IPCR', 'Alta Spot'];

        categories.forEach(cat => {
            const count = docs.filter(d => d.category === cat).length;
            const countEl = document.getElementById(`count-${cat.toLowerCase().replace(' ', '')}`);
            if (countEl) countEl.textContent = `${count} archivos`;

            const card = document.querySelector(`.doc-folder-card[data-category="${cat}"]`);
            if (card) {
                card.onclick = () => this.renderDocumentList(cat);
            }
        });

        document.getElementById('doc-folders-root').classList.remove('hidden');
        document.getElementById('doc-list-view').classList.add('hidden');
    }

    async renderDocumentList(category) {
        this.currentDocCategory = category;
        const allDocs = await this.store.getDocuments();
        const docs = allDocs.filter(d => d.category === category);
        const container = document.getElementById('doc-items-container');
        const title = document.getElementById('current-doc-category-title');

        if (title) title.textContent = category;

        // Hide grid, show list
        document.getElementById('doc-folders-root').classList.add('hidden');
        document.getElementById('doc-list-view').classList.remove('hidden');

        // Bind Back Button
        document.getElementById('btn-back-docs').onclick = () => {
            document.getElementById('doc-folders-root').classList.remove('hidden');
            document.getElementById('doc-list-view').classList.add('hidden');
        };

        // Bind Add Button
        document.getElementById('btn-add-doc').onclick = () => {
            this.showAddDocumentModal(category);
        };

        container.innerHTML = '';

        if (docs.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay documentos.</div>';
            return;
        }

        docs.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'data-card';

            let iconHtml = '';
            if (doc.fileType === 'pdf') {
                iconHtml = `<div class="doc-icon pdf">📄 PDF</div>`;
            } else {
                iconHtml = `<img src="${doc.fileData}" alt="Doc Image">`;
            }

            card.innerHTML = `
                ${iconHtml}
                <div class="data-info">
                    <h4>${doc.title}</h4>
                    <small>${new Date(doc.timestamp).toLocaleDateString()}</small>
                </div>
                <button class="btn-icon delete-doc" style="margin-left:auto; color:red;">🗑️</button>
            `;

            // Click on card to open/download
            card.onclick = async (e) => {
                if (e.target.closest('.delete-doc')) {
                    if (confirm('¿Eliminar documento?')) {
                        await this.store.deleteDocument(doc.id);
                        this.renderDocumentList(category);
                        this.renderDocumentFolders();
                    }
                    return;
                }
                this.openDocument(doc);
            };

            container.appendChild(card);
        });
    }

    showAddDocumentModal(category) {
        this.toggleModal('doc-form-container', true);
        document.getElementById('doc-category-input').value = category;
        document.getElementById('form-doc').reset();
        document.getElementById('doc-file-preview').innerHTML = '';
    }

    openDocument(doc) {
        if (doc.fileType === 'pdf') {
            // Check native
            // For web, open base64 pdf in new tab is tricky, usually download
            const link = document.createElement('a');
            link.href = doc.fileData;
            link.download = `${doc.title}.pdf`;
            link.click();
        } else {
            // Show image in a simple modal or same detail modal
            // Let's reuse detail modal but simplified
            const content = document.getElementById('detail-content');
            document.getElementById('detail-title').textContent = doc.title;
            content.innerHTML = `<img src="${doc.fileData}" style="width:100%; border-radius:8px;">`;
            // Hide edit/delete actions for now in this reused view or handle them
            // Quick fix: hide actions for doc view
            document.querySelector('#detail-modal .form-actions').style.display = 'none';
            this.toggleModal('detail-modal', true);

            // Restore actions when closed? tricky.
            // Better: create specific preview or just use lightbox.
            // For now, reuse detail modal is fine.
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
            const previewId = formId === 'form-hallazgo' ? 'hallazgo-foto-preview' : 'fragmento-foto-preview';
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
            ? `<img src="${this._getPhotoSrc(item.foto)}" alt="Foto">`
            : `<div class="img-placeholder"><span>📷</span></div>`;

        const TIPO_LABELS = { xilopalo: 'Xilópalo', vertebrados_fosiles: 'Vertebrados Fósiles', invertebrados_fosiles: 'Invertebrados Fósiles', icnofosil: 'Icnofósil' };
        const tipoLabel = type === 'fragmento' ? (TIPO_LABELS[item.tipo_vestigio] || (item.observaciones?.toLowerCase().includes('xilopalo') ? 'Xilópalo' : 'Vertebrados Fósiles')) : null;
        const title = type === 'hallazgo' ? `${item.codigo || 'S/N'} - ${item.tipo_material}` : `${tipoLabel || 'Vestigio'} - ${item.localidad}`;
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

    async renderHallazgos() {
        this._renderList('hallazgos-list', await this.store.getHallazgos(), 'hallazgo');
    }

    async renderFragmentos() {
        this._renderList('fragmentos-list', await this.store.getFragmentos(), 'fragmento');
    }

    async renderRescates() {
        this._renderList('rescates-list', await this.store.getRescates(), 'rescate');
    }

    async renderRoutesList() {
        const routes = await this.store.getRoutes();
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

            colorInput.addEventListener('change', async (e) => {
                await this.store.updateRoute(route.id, { color: e.target.value });
                document.dispatchEvent(new CustomEvent('route-updated'));
            });

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.className = 'btn-icon';
            deleteBtn.style.color = '#d32f2f';
            deleteBtn.onclick = async () => {
                if (confirm(`¿Eliminar la ruta "${route.name}"?`)) {
                    await this.store.deleteRoute(route.id);
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

    async updateFolderLists() {
        const folders = await this.store.getFolders();
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
function populateFolderSelect(selectElement, items, currentValue) {
    if (!selectElement) return;
    
    // Obtener carpetas únicas
    const folders = [...new Set(items.map(i => i.carpeta).filter(Boolean))];
    
    // Limpiar y reconstruir opciones
    selectElement.innerHTML = '<option value="">Todas las carpetas</option>';
    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder;
        if (folder === currentValue) option.selected = true;
        selectElement.appendChild(option);
    });
}