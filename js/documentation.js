// Documentation Tab Handler
// Manages document storage and viewing for the Documentation tab

class DocumentationManager {
    constructor(store) {
        this.store = store;
        this.currentCategory = null;
        this.init();
    }

    init() {
        // Folder card clicks
        document.querySelectorAll('.doc-folder-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.dataset.category;
                this.openCategory(category);
            });
        });

        // Back button
        document.getElementById('btn-back-docs')?.addEventListener('click', () => {
            this.closeCategory();
        });

        // Add document button
        document.getElementById('btn-add-doc')?.addEventListener('click', () => {
            this.showAddDocumentForm();
        });

        // Close document form
        document.getElementById('btn-close-doc')?.addEventListener('click', () => {
            this.hideAddDocumentForm();
        });

        // Document form submission
        document.getElementById('form-doc')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDocument(e.target);
        });

        // Update folder counts and load shared documents
        this.updateFolderCounts();
        this.loadSharedDocuments();
    }

    async loadSharedDocuments() {
        const container = document.getElementById('shared-documents-list');
        if (!container) return;

        const collectorInfo = this.store.getCollectorInfo();
        if (!collectorInfo.backendUrl) {
            container.innerHTML = '<div class="empty-state">No hay conexión al servidor configurada</div>';
            return;
        }

        try {
            const response = await fetch(`${collectorInfo.backendUrl}/api/collector/shared-documents`);

            if (!response.ok) {
                throw new Error('Error al cargar documentos compartidos');
            }

            const data = await response.json();
            const docs = data.data || [];

            if (docs.length === 0) {
                container.innerHTML = '<div class="empty-state">No hay documentos compartidos disponibles</div>';
                return;
            }

            container.innerHTML = '';
            docs.forEach(doc => {
                const item = document.createElement('div');
                item.className = 'data-card';
                item.innerHTML = `
                    <div class="item-icon" style="font-size: 2rem; background: var(--bg-input); width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">📤</div>
                    <div class="data-info">
                        <h4>${doc.title}</h4>
                        <small>${doc.category}${doc.description ? ' · ' + doc.description : ''}</small>
                        <small style="display: block; color: var(--text-muted); margin-top: 4px;">${new Date(doc.createdAt).toLocaleDateString()}</small>
                    </div>
                `;
                item.addEventListener('click', () => this.viewSharedDocument(doc));
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading shared documents:', error);
            container.innerHTML = '<div class="empty-state">Error al cargar documentos compartidos. Verifica la conexión.</div>';
        }
    }

    viewSharedDocument(doc) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-content');
        document.getElementById('detail-title').textContent = doc.title;

        content.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: #f8f9fa; border-radius: 12px; border: 2px dashed #ddd; margin-bottom: 20px;">
                <div style="font-size: 64px; margin-bottom: 15px;">📄</div>
                <h4 style="margin: 0 0 10px 0; color: var(--text-main);">${doc.title}</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 10px;">${doc.description || 'Documento compartido por administración'}</p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 25px;"><strong>Categoría:</strong> ${doc.category}</p>
                <button class="btn-primary" id="btn-native-view-shared" style="width: 100%; padding: 18px; font-size: 1.1rem; gap: 10px;">
                    📖 ABRIR DOCUMENTO
                </button>
            </div>
        `;

        const openShared = async () => {
            const btn = document.getElementById('btn-native-view-shared');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⌛ Procesando...';
            btn.disabled = true;

            try {
                // Shared documents from admin come with base64 file data
                if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                    const { Filesystem } = window.Capacitor.Plugins;
                    const { Share } = window.Capacitor.Plugins;

                    const fileName = `shared_${Date.now()}.pdf`;
                    const base64Data = doc.file.split(',')[1];

                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: base64Data,
                        directory: 'CACHE'
                    });

                    await Share.share({
                        title: doc.title,
                        files: [result.uri],
                        dialogTitle: 'Elegir lector de PDF...'
                    });
                } else {
                    // Browser - open in new tab
                    const blob = this.base64ToBlob(doc.file);
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, '_blank');
                }
            } catch (e) {
                console.error('Error opening shared PDF:', e);
                alert('No se pudo abrir el PDF. Asegúrate de tener un lector de PDF instalado.');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };

        document.getElementById('btn-native-view-shared').onclick = openShared;

        // Hide delete and edit buttons for shared documents
        document.getElementById('btn-delete-item').style.display = 'none';
        document.getElementById('btn-edit-item').style.display = 'none';

        modal.classList.remove('hidden');
    }

    openCategory(category) {
        this.currentCategory = category;
        document.getElementById('doc-folders-root').classList.add('hidden');
        document.getElementById('doc-list-view').classList.remove('hidden');
        document.getElementById('current-doc-category-title').textContent = category;
        document.getElementById('doc-category-input').value = category;
        this.renderDocuments(category);
    }

    closeCategory() {
        this.currentCategory = null;
        document.getElementById('doc-folders-root').classList.remove('hidden');
        document.getElementById('doc-list-view').classList.add('hidden');
        this.updateFolderCounts();
    }

    renderDocuments(category) {
        const docs = this.store.getDocuments().filter(d => d.category === category);
        const container = document.getElementById('doc-items-container');

        if (docs.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay documentos en esta categoría.</div>';
            return;
        }

        container.innerHTML = '';
        docs.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'data-card';
            item.innerHTML = `
                <div class="item-icon" style="font-size: 2rem; background: var(--bg-input); width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">📄</div>
                <div class="data-info">
                    <h4>${doc.title}</h4>
                    <small>${new Date(doc.timestamp).toLocaleDateString()}</small>
                </div>
            `;
            item.addEventListener('click', () => this.viewDocument(doc));
            container.appendChild(item);
        });
    }

    refresh() {
        this.updateFolderCounts();
        this.loadSharedDocuments(); // Reload shared docs
        if (this.currentCategory) {
            this.renderDocuments(this.currentCategory);
        }
    }

    viewDocument(doc) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-content');
        document.getElementById('detail-title').textContent = doc.title;

        if (doc.fileData.startsWith('data:application/pdf')) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: #f8f9fa; border-radius: 12px; border: 2px dashed #ddd; margin-bottom: 20px;">
                    <div style="font-size: 64px; margin-bottom: 15px;">📄</div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-main);">${doc.title}</h4>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 25px;">Documento PDF - Pulse el botón de abajo para abrirlo con el lector de su celular.</p>
                    <button class="btn-primary" id="btn-native-view" style="width: 100%; padding: 18px; font-size: 1.1rem; gap: 10px;">
                        📖 ABRIR DOCUMENTO
                    </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="btn-secondary" id="btn-share-doc" style="width: 100%; justify-content: center; gap: 10px;">
                        📤 Enviar / Compartir
                    </button>
                </div>
            `;

            const openNative = async () => {
                const btn = document.getElementById('btn-native-view');
                const originalText = btn.innerHTML;
                btn.innerHTML = '⌛ Procesando...';
                btn.disabled = true;

                try {
                    // Logic for Capacitor (Native App)
                    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                        const { Filesystem } = window.Capacitor.Plugins;
                        const { Share } = window.Capacitor.Plugins;
                        const { Directory } = window.Capacitor.Plugins.Filesystem || {}; // Handle enum

                        const fileName = `temp_${Date.now()}.pdf`;
                        const base64Data = doc.fileData.split(',')[1];

                        // 1. Save to cache or temporary directory
                        const result = await Filesystem.writeFile({
                            path: fileName,
                            data: base64Data,
                            directory: 'CACHE'
                        });

                        // 2. Share/Open the file
                        await Share.share({
                            title: doc.title,
                            files: [result.uri],
                            dialogTitle: 'Elegir lector de PDF...'
                        });
                    } else {
                        // Logic for Browser (PWA)
                        const blob = this.base64ToBlob(doc.fileData);
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                    }
                } catch (e) {
                    console.error('Error opening PDF:', e);
                    alert('No se pudo abrir el PDF. Asegúrate de tener un lector de PDF instalado.');
                } finally {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            };

            document.getElementById('btn-native-view').onclick = openNative;
            document.getElementById('btn-share-doc').onclick = openNative;

        } else {
            // Backup for legacy images if any exist
            content.innerHTML = `
                <div style="text-align: center;">
                    <img src="${doc.fileData}" alt="${doc.title}" style="max-width: 100%; border-radius: 8px; box-shadow: var(--shadow-sm);">
                    <p style="margin-top: 10px; color: var(--text-muted);">Archivo de imagen (Legado)</p>
                </div>
            `;
        }

        // Delete button
        const btnDelete = document.getElementById('btn-delete-item');
        btnDelete.style.display = 'block';
        btnDelete.onclick = async () => {
            if (confirm(`¿Eliminar "${doc.title}"?`)) {
                await this.store.deleteDocument(doc.id);
                modal.classList.add('hidden');
                this.renderDocuments(this.currentCategory);
                this.updateFolderCounts();
            }
        };

        // Hide edit button for documents
        document.getElementById('btn-edit-item').style.display = 'none';

        modal.classList.remove('hidden');
    }

    base64ToBlob(base64) {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);

        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }

        return new Blob([uInt8Array], { type: contentType });
    }

    showAddDocumentForm() {
        document.getElementById('doc-form-container').classList.remove('hidden');
        document.getElementById('form-doc').reset();
    }

    hideAddDocumentForm() {
        document.getElementById('doc-form-container').classList.add('hidden');
    }

    async saveDocument(form) {
        const formData = new FormData(form);
        const fileInput = form.querySelector('input[type="file"]');

        if (!fileInput.files[0]) {
            alert('Por favor selecciona un archivo');
            return;
        }

        const file = fileInput.files[0];
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Solo se permiten archivos PDF en esta sección.');
            return;
        }

        const fileData = await this.readFileAsDataURL(file);

        const doc = {
            title: formData.get('title'),
            category: formData.get('category'),
            fileData: fileData,
            fileName: file.name,
            fileType: file.type
        };

        await this.store.addDocument(doc);
        this.hideAddDocumentForm();
        this.renderDocuments(this.currentCategory);
        this.updateFolderCounts();
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    updateFolderCounts() {
        const docs = this.store.getDocuments();
        const counts = {
            'Permisos': 0,
            'ATS': 0,
            'IPCR': 0,
            'Alta Spot': 0
        };

        docs.forEach(doc => {
            if (counts.hasOwnProperty(doc.category)) {
                counts[doc.category]++;
            }
        });

        document.getElementById('count-permisos').textContent = `${counts['Permisos']} archivo${counts['Permisos'] !== 1 ? 's' : ''}`;
        document.getElementById('count-ats').textContent = `${counts['ATS']} archivo${counts['ATS'] !== 1 ? 's' : ''}`;
        document.getElementById('count-ipcr').textContent = `${counts['IPCR']} archivo${counts['IPCR'] !== 1 ? 's' : ''}`;
        document.getElementById('count-altaspot').textContent = `${counts['Alta Spot']} archivo${counts['Alta Spot'] !== 1 ? 's' : ''}`;
    }
}
