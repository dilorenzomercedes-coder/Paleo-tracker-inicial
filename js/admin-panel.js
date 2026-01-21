// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.API_URL = localStorage.getItem('admin_api_url') || 'http://localhost:3000';
        this.token = localStorage.getItem('admin_token');
        this.username = localStorage.getItem('admin_username');
        this.currentView = 'overview';

        this.init();
    }

    init() {
        // Check if already logged in
        if (this.token) {
            this.showDashboard();
            this.loadInitialData();
        } else {
            this.showLogin();
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));

        // Logout
        document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());

        // Menu navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.loadView(view);
            });
        });

        // Modal close buttons
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.closeModal;
                this.closeModal(modalId);
            });
        });

        // Shared document management
        document.getElementById('btn-add-shared-doc')?.addEventListener('click', () => {
            this.openModal('modal-add-shared-doc');
        });

        document.getElementById('form-shared-doc')?.addEventListener('submit', (e) => {
            this.handleAddSharedDoc(e);
        });

        // Export buttons
        document.getElementById('btn-export-kml-all')?.addEventListener('click', () => this.exportKML());
        document.getElementById('btn-export-json-backup')?.addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-export-csv-hallazgos')?.addEventListener('click', () => this.exportCSV('hallazgos'));
        document.getElementById('btn-export-csv-fragmentos')?.addEventListener('click', () => this.exportCSV('fragmentos'));
        document.getElementById('btn-download-photos-all')?.addEventListener('click', () => this.downloadPhotos());
        document.getElementById('btn-download-complete')?.addEventListener('click', () => this.downloadComplete());

        // Filter-specific exports
        document.getElementById('btn-export-hallazgos-kml')?.addEventListener('click', () => {
            const collector = document.getElementById('filter-hallazgos-collector').value;
            const folder = document.getElementById('filter-hallazgos-folder').value;
            this.exportKML(collector, folder);
        });

        document.getElementById('btn-export-fragmentos-kml')?.addEventListener('click', () => {
            const collector = document.getElementById('filter-fragmentos-collector').value;
            const folder = document.getElementById('filter-fragmentos-folder').value;
            this.exportKML(collector, folder);
        });

        document.getElementById('btn-download-documents-zip')?.addEventListener('click', () => {
            const category = document.getElementById('filter-documents-category').value;
            this.downloadDocuments(category);
        });

        // Filters
        document.getElementById('filter-hallazgos-collector')?.addEventListener('change', () => this.loadHallazgos());
        document.getElementById('filter-hallazgos-folder')?.addEventListener('change', () => this.loadHallazgos());
        document.getElementById('filter-fragmentos-collector')?.addEventListener('change', () => this.loadFragmentos());
        document.getElementById('filter-fragmentos-folder')?.addEventListener('change', () => this.loadFragmentos());
        document.getElementById('filter-routes-collector')?.addEventListener('change', () => this.loadRoutes());
        document.getElementById('filter-documents-collector')?.addEventListener('change', () => this.loadDocuments());
        document.getElementById('filter-documents-category')?.addEventListener('change', () => this.loadDocuments());
    }

    showLogin() {
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('dashboard-screen').classList.remove('active');
    }

    showDashboard() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('dashboard-screen').classList.add('active');
        document.getElementById('user-name').textContent = this.username || 'Admin';
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');
        const serverUrl = formData.get('serverUrl');

        this.API_URL = serverUrl;
        localStorage.setItem('admin_api_url', serverUrl);

        try {
            const response = await fetch(`${this.API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error de autenticación');
            }

            const data = await response.json();
            this.token = data.token;
            this.username = username;

            localStorage.setItem('admin_token', this.token);
            localStorage.setItem('admin_username', this.username);

            this.showDashboard();
            this.loadInitialData();
        } catch (error) {
            console.error('Login error:', error);
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    }

    logout() {
        this.token = null;
        this.username = null;
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        this.showLogin();
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.API_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status === 401) {
                this.logout();
                throw new Error('Sesión expirada');
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error en la solicitud');
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async downloadFile(endpoint, filename) {
        const url = `${this.API_URL}${endpoint}`;

        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Error al descargar archivo');

            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Download error:', error);
            alert('Error al descargar: ' + error.message);
        }
    }

    loadView(viewName) {
        // Update menu
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`view-${viewName}`).classList.add('active');

        this.currentView = viewName;

        // Load data for the view
        switch (viewName) {
            case 'overview':
                this.loadOverview();
                break;
            case 'collectors':
                this.loadCollectors();
                break;
            case 'hallazgos':
                this.loadHallazgos();
                break;
            case 'fragmentos':
                this.loadFragmentos();
                break;
            case 'routes':
                this.loadRoutes();
                break;
            case 'documents':
                this.loadDocuments();
                break;
            case 'shared-docs':
                this.loadSharedDocs();
                break;
        }
    }

    async loadInitialData() {
        await this.loadOverview();
        await this.loadCollectorFilters();
    }

    async loadOverview() {
        try {
            const stats = await this.apiRequest('/api/admin/stats');

            document.getElementById('stat-hallazgos').textContent = stats.stats.totals.hallazgos;
            document.getElementById('stat-fragmentos').textContent = stats.stats.totals.fragmentos;
            document.getElementById('stat-routes').textContent = stats.stats.totals.routes;
            document.getElementById('stat-collectors').textContent = stats.stats.totals.collectors;

            // Recent activity
            const activityContainer = document.getElementById('recent-activity');
            if (stats.stats.recent.hallazgos.length > 0) {
                activityContainer.innerHTML = stats.stats.recent.hallazgos.map(h => `
          <div class="activity-item">
            <span class="icon">📍</span>
            <span><strong>${h.collector?.name || h.collector?.collectorId || 'Sin nombre'}</strong> registró un hallazgo en <strong>${h.localidad}</strong></span>
          </div>
        `).join('');
            } else {
                activityContainer.innerHTML = '<p class="loading">No hay actividad reciente</p>';
            }
        } catch (error) {
            console.error('Error loading overview:', error);
        }
    }

    async loadCollectorFilters() {
        try {
            const data = await this.apiRequest('/api/admin/collectors');
            const collectors = data.data;

            // Populate all collector filters
            const filterIds = [
                'filter-hallazgos-collector',
                'filter-fragmentos-collector',
                'filter-routes-collector',
                'filter-documents-collector'
            ];

            filterIds.forEach(id => {
                const select = document.getElementById(id);
                if (select) {
                    select.innerHTML = '<option value="">Todos los colectores</option>' +
                        collectors.map(c => `<option value="${c.collectorId}">${c.name || c.collectorId}</option>`).join('');
                }
            });
        } catch (error) {
            console.error('Error loading collector filters:', error);
        }
    }

    async loadCollectors() {
        try {
            const data = await this.apiRequest('/api/admin/collectors');
            const tbody = document.getElementById('collectors-table-body');

            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">No hay colectores registrados</td></tr>';
                return;
            }

            tbody.innerHTML = data.data.map(c => `
        <tr>
          <td>${c.collectorId}</td>
          <td>${c.name || 'Sin nombre'}</td>
          <td>${c.lastSync ? new Date(c.lastSync).toLocaleString() : 'Nunca'}</td>
          <td>${c.stats.hallazgos}</td>
          <td>${c.stats.fragmentos}</td>
          <td>${c.stats.routes}</td>
          <td><strong>${c.stats.total}</strong></td>
        </tr>
      `).join('');
        } catch (error) {
            console.error('Error loading collectors:', error);
        }
    }

    async loadHallazgos() {
        try {
            const collector = document.getElementById('filter-hallazgos-collector')?.value || '';
            const folder = document.getElementById('filter-hallazgos-folder')?.value || '';

            const params = new URLSearchParams();
            if (collector) params.append('collector', collector);
            if (folder) params.append('folder', folder);

            const data = await this.apiRequest(`/api/admin/hallazgos?${params}`);
            const tbody = document.getElementById('hallazgos-table-body');

            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8">No hay hallazgos</td></tr>';
                return;
            }

            tbody.innerHTML = data.data.map(h => {
                // Check for any of the photo fields (foto1, foto2, foto3)
                const foto = h.foto1 || h.foto2 || h.foto3;
                const fotoHTML = foto ?
                    `<img src="${foto}" alt="Foto" style="width:60px;height:60px;object-fit:cover;cursor:pointer;border-radius:4px;" onclick="window.adminPanel.viewPhoto('${foto.replace(/'/g, "&apos;")}', '${(h.codigo || 'Hallazgo').replace(/'/g, "&apos;")}')">` :
                    '<span style="color:#999;">Sin foto</span>';

                return `
        <tr>
          <td>${fotoHTML}</td>
          <td>${h.fecha || 'N/A'}</td>
          <td>${h.collector?.name || h.collector?.collectorId || 'N/A'}</td>
          <td>${h.localidad || 'N/A'}</td>
          <td>${h.folder || 'N/A'}</td>
          <td>${h.tipo_material || 'N/A'}</td>
          <td>${h.codigo || 'N/A'}</td>
          <td>${h.lat && h.lng ? `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}` : 'N/A'}</td>
        </tr>
      `;
            }).join('');

            // Update folder filter
            this.updateFolderFilter(data.data, 'filter-hallazgos-folder');
        } catch (error) {
            console.error('Error loading hallazgos:', error);
        }
    }

    async loadFragmentos() {
        try {
            const collector = document.getElementById('filter-fragmentos-collector')?.value || '';
            const folder = document.getElementById('filter-fragmentos-folder')?.value || '';

            const params = new URLSearchParams();
            if (collector) params.append('collector', collector);
            if (folder) params.append('folder', folder);

            const data = await this.apiRequest(`/api/admin/fragmentos?${params}`);
            const tbody = document.getElementById('fragmentos-table-body');

            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No hay fragmentos</td></tr>';
                return;
            }

            tbody.innerHTML = data.data.map(f => `
        <tr>
          <td>${f.fecha || 'N/A'}</td>
          <td>${f.collector?.name || f.collector?.collectorId || 'N/A'}</td>
          <td>${f.localidad || 'N/A'}</td>
          <td>${f.folder || 'N/A'}</td>
          <td>${f.lat && f.lng ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}` : 'N/A'}</td>
          <td>${f.observaciones || '-'}</td>
        </tr>
      `).join('');

            this.updateFolderFilter(data.data, 'filter-fragmentos-folder');
        } catch (error) {
            console.error('Error loading fragmentos:', error);
        }
    }

    async loadRoutes() {
        try {
            const collector = document.getElementById('filter-routes-collector')?.value || '';
            const params = new URLSearchParams();
            if (collector) params.append('collector', collector);

            const data = await this.apiRequest(`/api/admin/routes?${params}`);
            const tbody = document.getElementById('routes-table-body');

            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No hay rutas</td></tr>';
                return;
            }

            tbody.innerHTML = data.data.map(r => `
        <tr>
          <td>${r.name || 'Sin nombre'}</td>
          <td>${r.collector?.name || r.collector?.collectorId || 'N/A'}</td>
          <td>${new Date(r.createdAt).toLocaleString()}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="adminPanel.downloadRoute(${r.id}, '${r.name}')">
              Descargar
            </button>
          </td>
        </tr>
      `).join('');
        } catch (error) {
            console.error('Error loading routes:', error);
        }
    }

    async loadDocuments() {
        try {
            const collector = document.getElementById('filter-documents-collector')?.value || '';
            const category = document.getElementById('filter-documents-category')?.value || '';

            const params = new URLSearchParams();
            if (collector) params.append('collector', collector);
            if (category) params.append('category', category);

            const data = await this.apiRequest(`/api/admin/documents?${params}`);
            const tbody = document.getElementById('documents-table-body');

            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No hay documentos</td></tr>';
                return;
            }

            tbody.innerHTML = data.data.map(d => `
        <tr>
          <td>${d.title || 'Sin título'}</td>
          <td>${d.category || 'N/A'}</td>
          <td>${d.collector?.name || d.collector?.collectorId || 'N/A'}</td>
          <td>${new Date(d.createdAt).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="adminPanel.viewDocument(${d.id})">
              Ver
            </button>
          </td>
        </tr>
      `).join('');
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    }

    async loadSharedDocs() {
        try {
            const data = await this.apiRequest('/api/admin/shared-documents');
            const tbody = document.getElementById('shared-docs-table-body');

            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No hay documentos compartidos</td></tr>';
                return;
            }

            tbody.innerHTML = data.data.map(d => `
        <tr>
          <td>${d.title}</td>
          <td>${d.category}</td>
          <td>${d.description || '-'}</td>
          <td>${new Date(d.createdAt).toLocaleDateString()}</td>
          <td><span class="badge ${d.isActive ? 'badge-success' : 'badge-secondary'}">${d.isActive ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteSharedDoc(${d.id})">
              Eliminar
            </button>
          </td>
        </tr>
      `).join('');
        } catch (error) {
            console.error('Error loading shared docs:', error);
        }
    }

    updateFolderFilter(data, filterId) {
        const folders = [...new Set(data.map(item => item.folder).filter(Boolean))];
        const select = document.getElementById(filterId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">Todas las carpetas</option>' +
            folders.map(f => `<option value="${f}">${f}</option>`).join('');

        if (folders.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    async handleAddSharedDoc(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const fileInput = document.getElementById('shared-doc-file');
        const file = fileInput.files[0];

        if (!file) {
            alert('Por favor selecciona un archivo PDF');
            return;
        }

        try {
            const base64 = await this.fileToBase64(file);

            const payload = {
                title: formData.get('title'),
                category: formData.get('category'),
                description: formData.get('description'),
                file: base64
            };

            await this.apiRequest('/api/admin/shared-documents', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            alert('Documento compartido creado exitosamente');
            this.closeModal('modal-add-shared-doc');
            e.target.reset();
            this.loadSharedDocs();
        } catch (error) {
            alert('Error al crear documento: ' + error.message);
        }
    }

    async deleteSharedDoc(id) {
        if (!confirm('¿Eliminar este documento compartido?')) return;

        try {
            await this.apiRequest(`/api/admin/shared-documents/${id}`, { method: 'DELETE' });
            alert('Documento eliminado');
            this.loadSharedDocs();
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
        }
    }

    downloadRoute(id, name) {
        // Routes are stored in the database, we need to get it and download
        alert('Función de descarga de ruta individual en desarrollo');
    }

    viewDocument(id) {
        alert('Función de visualización de documento en desarrollo');
    }

    viewPhoto(src, title) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('photo-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'photo-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="photo-modal-title"></h2>
                        <button class="btn-close" onclick="window.adminPanel.closeModal('photo-modal')">&times;</button>
                    </div>
                    <div style="text-align:center;padding:20px;">
                        <img id="photo-modal-image" style="max-width:100%;max-height:70vh;border-radius:8px;">
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" id="photo-download-btn">Descargar Foto</button>
                        <button class="btn btn-secondary" onclick="window.adminPanel.closeModal('photo-modal')">Cerrar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('photo-modal-title').textContent = title;
        document.getElementById('photo-modal-image').src = src;

        document.getElementById('photo-download-btn').onclick = () => {
            const a = document.createElement('a');
            a.href = src;
            a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.jpg`;
            a.click();
        };

        this.openModal('photo-modal');
    }


    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    // Export functions
    exportKML(collector = '', folder = '') {
        const params = new URLSearchParams();
        if (collector) params.append('collector', collector);
        if (folder) params.append('folder', folder);

        const filename = `paleo_export_${new Date().toISOString().slice(0, 10)}.kml`;
        this.downloadFile(`/api/admin/export/kml?${params}`, filename);
    }

    exportJSON() {
        const filename = `paleo_backup_${new Date().toISOString().slice(0, 10)}.json`;
        this.downloadFile('/api/admin/export/json', filename);
    }

    exportCSV(type) {
        const filename = `${type}_${new Date().toISOString().slice(0, 10)}.csv`;
        this.downloadFile(`/api/admin/export/csv/${type}`, filename);
    }

    downloadPhotos(collector = '', folder = '') {
        const params = new URLSearchParams();
        if (collector) params.append('collector', collector);
        if (folder) params.append('folder', folder);

        const filename = `fotos_${collector || 'todas'}_${new Date().toISOString().slice(0, 10)}.zip`;
        this.downloadFile(`/api/admin/download/photos?${params}`, filename);
    }

    downloadDocuments(category = '') {
        const params = new URLSearchParams();
        if (category) params.append('category', category);

        const filename = `documentos_${category || 'todos'}_${new Date().toISOString().slice(0, 10)}.zip`;
        this.downloadFile(`/api/admin/download/documents?${params}`, filename);
    }

    downloadComplete() {
        const filename = `paleo_completo_${new Date().toISOString().slice(0, 10)}.zip`;
        this.downloadFile('/api/admin/download/complete', filename);
    }
}

// Initialize the admin panel
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel; // Expose globally for onclick handlers
