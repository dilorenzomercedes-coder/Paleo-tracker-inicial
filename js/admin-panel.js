// Admin Panel JavaScript

// Filter Manager for advanced filtering
class FilterManager {
    constructor() {
        this.filters = {
            text: '',
            dateFrom: null,
            dateTo: null,
            collector: '',
            folder: ''
        };
        this.originalData = [];
    }

    setFilter(key, value) {
        this.filters[key] = value;
    }

    clearFilters() {
        this.filters = {
            text: '',
            dateFrom: null,
            dateTo: null,
            collector: '',
            folder: ''
        };
    }

    applyFilters(data) {
        let filtered = [...data];

        // Text search
        if (this.filters.text) {
            const term = this.filters.text.toLowerCase();
            filtered = filtered.filter(item => {
                const searchableText = [
                    item.codigo,
                    item.tipo_material,
                    item.localidad,
                    item.formacion,
                    item.observaciones
                ].filter(Boolean).join(' ').toLowerCase();

                return searchableText.includes(term);
            });
        }

        // Date range filter
        if (this.filters.dateFrom || this.filters.dateTo) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.fecha || item.createdAt);

                if (this.filters.dateFrom) {
                    const fromDate = new Date(this.filters.dateFrom);
                    if (itemDate < fromDate) return false;
                }

                if (this.filters.dateTo) {
                    const toDate = new Date(this.filters.dateTo);
                    toDate.setHours(23, 59, 59, 999); // Include entire day
                    if (itemDate > toDate) return false;
                }

                return true;
            });
        }

        // Collector filter
        if (this.filters.collector) {
            filtered = filtered.filter(item =>
                item.collector?.collectorId === this.filters.collector
            );
        }

        // Folder filter
        if (this.filters.folder) {
            filtered = filtered.filter(item =>
                item.folder === this.filters.folder
            );
        }

        return filtered;
    }

    getActiveFiltersCount() {
        return Object.values(this.filters).filter(v => v).length;
    }

    getActiveFiltersText() {
        const active = [];

        if (this.filters.text) {
            active.push(`Texto: "${this.filters.text}"`);
        }
        if (this.filters.dateFrom) {
            active.push(`Desde: ${this.filters.dateFrom}`);
        }
        if (this.filters.dateTo) {
            active.push(`Hasta: ${this.filters.dateTo}`);
        }
        if (this.filters.collector) {
            active.push(`Colector: ${this.filters.collector}`);
        }
        if (this.filters.folder) {
            active.push(`Carpeta: ${this.filters.folder}`);
        }

        return active;
    }
}

class AdminPanel {
    constructor() {
        this.API_URL = localStorage.getItem('admin_api_url') || 'http://localhost:3000';
        this.token = localStorage.getItem('admin_token');
        this.username = localStorage.getItem('admin_username');
        this.currentView = 'overview';

        // Initialize filter manager
        this.filterManager = new FilterManager();

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

        // Advanced filters for hallazgos
        let searchDebounce;
        document.getElementById('filter-hallazgos-search')?.addEventListener('input', (e) => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                this.filterManager.setFilter('text', e.target.value);
                this.loadHallazgos();
            }, 300); // Debounce 300ms
        });

        document.getElementById('filter-hallazgos-date-from')?.addEventListener('change', (e) => {
            this.filterManager.setFilter('dateFrom', e.target.value);
            this.loadHallazgos();
        });

        document.getElementById('filter-hallazgos-date-to')?.addEventListener('change', (e) => {
            this.filterManager.setFilter('dateTo', e.target.value);
            this.loadHallazgos();
        });

        document.getElementById('btn-clear-hallazgos-filters')?.addEventListener('click', () => {
            this.clearHallazgosFilters();
        });

        // Edit hallazgo form
        document.getElementById('form-edit-hallazgo')?.addEventListener('submit', (e) => {
            this.handleEditHallazgo(e);
        });
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
            case 'map':
                this.loadMap();
                break;
            case 'folders':
                this.loadFolders();
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

            const rawData = await this.apiRequest(`/api/admin/hallazgos?${params}`);

            // Apply advanced filters
            this.filterManager.setFilter('collector', collector);
            this.filterManager.setFilter('folder', folder);
            const filteredData = this.filterManager.applyFilters(rawData.data);

            // Update filter summary
            this.updateFilterSummary('hallazgos', filteredData.length, rawData.data.length);

            const tbody = document.getElementById('hallazgos-table-body');

            if (filteredData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9">No hay hallazgos con los filtros aplicados</td></tr>';
                return;
            }

            // Store current data for editing
            this.currentHallazgos = filteredData;

            tbody.innerHTML = filteredData.map(h => {
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
          <td>
            <button class="btn-icon" onclick="window.adminPanel.editHallazgo('${h.id}')" title="Editar">
              ✏️
            </button>
          </td>
        </tr>
      `;
            }).join('');

            // Update folder filter
            this.updateFolderFilter(rawData.data, 'filter-hallazgos-folder');
        } catch (error) {
            console.error('Error loading hallazgos:', error);
            alert('Error cargando hallazgos: ' + error.message);
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
                tbody.innerHTML = '<tr><td colspan="8">No hay fragmentos</td></tr>';
                return;
            }

            // Store current data for export
            this.currentFragmentos = data.data;

            tbody.innerHTML = data.data.map(f => {
                // Display photo if available
                const foto = f.foto;
                const fotoHTML = foto ?
                    `<img src="${foto}" alt="Foto" style="width:60px;height:60px;object-fit:cover;cursor:pointer;border-radius:4px;" onclick="window.adminPanel.viewPhoto('${foto.replace(/'/g, "&apos;")}', 'Fragmento - ${(f.folder || 'N/A').replace(/'/g, "&apos;")}')">` :
                    '<span style="color:#999;">Sin foto</span>';

                return `
        <tr>
          <td>${fotoHTML}</td>
          <td>${f.fecha || 'N/A'}</td>
          <td>${f.collector?.name || f.collector?.collectorId || 'N/A'}</td>
          <td>${f.localidad || 'N/A'}</td>
          <td>${f.folder || 'N/A'}</td>
          <td>${f.lat && f.lng ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}` : 'N/A'}</td>
          <td>${f.observaciones || '-'}</td>
          <td>
            ${foto ? `<button class="btn-icon" onclick="window.adminPanel.downloadPhoto('${foto.replace(/'/g, "&apos;")}', 'fragmento_${f.folder || 'img'}_${f.fecha || 'photo'}.jpg')" title="Descargar foto">📥</button>` : ''}
            <button class="btn-icon" onclick="window.adminPanel.editFragmento('${f.id}')" title="Editar">✏️</button>
          </td>
        </tr>
      `;
            }).join('');

            this.updateFolderFilter(data.data, 'filter-fragmentos-folder');
        } catch (error) {
            console.error('Error loading fragmentos:', error);
            alert('Error cargando fragmentos: ' + error.message);
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

    async loadMap() {
        try {
            // Initialize map if not already done
            if (!this.map) {
                this.map = L.map('admin-map').setView([-38.95, -68.06], 13);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                this.mapLayers = {
                    hallazgos: L.layerGroup().addTo(this.map),
                    fragmentos: L.layerGroup().addTo(this.map),
                    routes: L.layerGroup().addTo(this.map)
                };

                // Setup event listeners for filters
                document.getElementById('filter-map-collector')?.addEventListener('change', () => this.updateMap());
                document.getElementById('filter-map-folder')?.addEventListener('change', () => this.updateMap());
                document.getElementById('map-show-hallazgos')?.addEventListener('change', () => this.updateMapVisibility());
                document.getElementById('map-show-fragmentos')?.addEventListener('change', () => this.updateMapVisibility());
                document.getElementById('map-show-routes')?.addEventListener('change', () => this.updateMapVisibility());
            }

            // Force map to resize (fixes Leaflet rendering issue)
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);

            // Load collector filters
            await this.loadCollectorFilters();

            // Update map with data
            await this.updateMap();

        } catch (error) {
            console.error('Error loading map:', error);
        }
    }

    async updateMap() {
        try {
            const collector = document.getElementById('filter-map-collector')?.value || '';
            const folder = document.getElementById('filter-map-folder')?.value || '';

            const params = new URLSearchParams();
            if (collector) params.append('collector', collector);
            if (folder) params.append('folder', folder);

            // Clear existing markers
            this.mapLayers.hallazgos.clearLayers();
            this.mapLayers.fragmentos.clearLayers();
            this.mapLayers.routes.clearLayers();

            // Load and display data
            const [hallazgosData, fragmentosData, routesData] = await Promise.all([
                this.apiRequest(`/api/admin/hallazgos?${params}`),
                this.apiRequest(`/api/admin/fragmentos?${params}`),
                this.apiRequest(`/api/admin/routes?${params}`)
            ]);

            // Add hallazgos markers
            hallazgosData.data.forEach(h => {
                if (h.lat && h.lng) {
                    const foto = h.foto1 || h.foto2 || h.foto3;
                    const fotoHTML = foto ? `<br/><img src="${foto}" style="max-width:200px;max-height:150px;margin-top:5px;">` : '';

                    const marker = L.marker([h.lat, h.lng], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    });

                    marker.bindPopup(`
                        <b>${h.codigo || 'Hallazgo'}</b><br/>
                        Fecha: ${h.fecha}<br/>
                        Localidad: ${h.localidad}<br/>
                        Tipo: ${h.tipo_material || 'N/A'}
                        ${fotoHTML}
                    `);

                    this.mapLayers.hallazgos.addLayer(marker);
                }
            });

            // Add fragmentos markers
            fragmentosData.data.forEach(f => {
                if (f.lat && f.lng) {
                    const marker = L.marker([f.lat, f.lng], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    });

                    marker.bindPopup(`
                        <b>Fragmento</b><br/>
                        Fecha: ${f.fecha}<br/>
                        Localidad: ${f.localidad}
                    `);

                    this.mapLayers.fragmentos.addLayer(marker);
                }
            });

            // Add routes as polylines/polygons
            routesData.data.forEach(route => {
                if (!route.content) return; // Campo correcto: content

                const parsed = this.parseRouteKML(route.content);
                if (!parsed || parsed.coordinates.length < 2) return;

                let layer;
                if (parsed.type === 'LineString') {
                    layer = L.polyline(parsed.coordinates, {
                        color: '#3498db',  // Azul
                        weight: 3,
                        opacity: 0.7
                    });
                } else if (parsed.type === 'Polygon') {
                    layer = L.polygon(parsed.coordinates, {
                        color: '#9b59b6',  // Morado
                        fillColor: '#9b59b6',
                        fillOpacity: 0.2,
                        weight: 2
                    });
                }

                if (layer) {
                    layer.bindPopup(`
                        <b>${parsed.name}</b><br/>
                        Fecha: ${route.fecha || 'N/A'}<br/>
                        ${route.folder ? `Carpeta: ${route.folder}<br/>` : ''}
                        ${parsed.description ? `<br/>${parsed.description}` : ''}
                    `);

                    this.mapLayers.routes.addLayer(layer);
                }
            });

            // Update folder filter
            const allData = [...hallazgosData.data, ...fragmentosData.data, ...routesData.data];
            this.updateFolderFilter(allData, 'filter-map-folder');

            // Update visibility
            this.updateMapVisibility();

        } catch (error) {
            console.error('Error updating map:', error);
        }
    }

    updateMapVisibility() {
        const showHallazgos = document.getElementById('map-show-hallazgos')?.checked;
        const showFragmentos = document.getElementById('map-show-fragmentos')?.checked;
        const showRoutes = document.getElementById('map-show-routes')?.checked;

        if (showHallazgos) {
            this.map.addLayer(this.mapLayers.hallazgos);
        } else {
            this.map.removeLayer(this.mapLayers.hallazgos);
        }

        if (showFragmentos) {
            this.map.addLayer(this.mapLayers.fragmentos);
        } else {
            this.map.removeLayer(this.mapLayers.fragmentos);
        }

        if (showRoutes) {
            this.map.addLayer(this.mapLayers.routes);
        } else {
            this.map.removeLayer(this.mapLayers.routes);
        }
    }

    parseRouteKML(kmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlString, 'text/xml');

            // Verificar errores de parseo
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                console.error('Error parsing KML:', parseError);
                return null;
            }

            const name = xmlDoc.querySelector('Placemark name')?.textContent || 'Ruta';
            const description = xmlDoc.querySelector('Placemark description')?.textContent || '';

            // Intentar LineString (rutas lineales)
            const lineString = xmlDoc.querySelector('LineString coordinates');
            if (lineString) {
                const coordsText = lineString.textContent.trim();
                const points = coordsText.split(/\s+/).filter(p => p.length > 0);

                const coordinates = [];
                points.forEach(point => {
                    const [lng, lat, alt] = point.split(',').map(Number);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        coordinates.push([lat, lng]); // Leaflet usa [lat, lng]
                    }
                });

                if (coordinates.length > 0) {
                    return { name, description, coordinates, type: 'LineString' };
                }
            }

            // Intentar Polygon (áreas cerradas)
            const polygon = xmlDoc.querySelector('Polygon outerBoundaryIs coordinates');
            if (polygon) {
                const coordsText = polygon.textContent.trim();
                const points = coordsText.split(/\s+/).filter(p => p.length > 0);

                const coordinates = [];
                points.forEach(point => {
                    const [lng, lat, alt] = point.split(',').map(Number);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        coordinates.push([lat, lng]);
                    }
                });

                if (coordinates.length > 0) {
                    return { name, description, coordinates, type: 'Polygon' };
                }
            }

            return null;
        } catch (error) {
            console.error('Error parsing route KML:', error);
            return null;
        }
    }

    async loadFolders() {
        try {
            // Cargar todos los hallazgos y fragmentos
            const [hallazgosData, fragmentosData] = await Promise.all([
                this.apiRequest('/api/admin/hallazgos'),
                this.apiRequest('/api/admin/fragmentos')
            ]);

            // Agrupar por carpeta
            const folderMap = {};

            hallazgosData.data.forEach(h => {
                const folderName = h.folder || 'Sin Carpeta';
                if (!folderMap[folderName]) {
                    folderMap[folderName] = {
                        name: folderName,
                        hallazgos: [],
                        fragmentos: [],
                        collectors: new Set(),
                        lastActivity: null
                    };
                }
                folderMap[folderName].hallazgos.push(h);
                const collectorName = h.collector?.name || h.collector?.collectorId || 'Desconocido';
                folderMap[folderName].collectors.add(collectorName);

                // Actualizar última actividad
                const date = new Date(h.createdAt || h.fecha);
                if (!folderMap[folderName].lastActivity || date > folderMap[folderName].lastActivity) {
                    folderMap[folderName].lastActivity = date;
                }
            });

            // Similar para fragmentos
            fragmentosData.data.forEach(f => {
                const folderName = f.folder || 'Sin Carpeta';
                if (!folderMap[folderName]) {
                    folderMap[folderName] = {
                        name: folderName,
                        hallazgos: [],
                        fragmentos: [],
                        collectors: new Set(),
                        lastActivity: null
                    };
                }
                folderMap[folderName].fragmentos.push(f);
                const collectorName = f.collector?.name || f.collector?.collectorId || 'Desconocido';
                folderMap[folderName].collectors.add(collectorName);

                const date = new Date(f.createdAt || f.fecha);
                if (!folderMap[folderName].lastActivity || date > folderMap[folderName].lastActivity) {
                    folderMap[folderName].lastActivity = date;
                }
            });

            // Convertir Sets a Arrays y guardar datos
            this.foldersData = Object.values(folderMap).map(folder => ({
                ...folder,
                collectors: Array.from(folder.collectors)
            }));

            // Renderizar cards
            this.renderFolderCards();

            // Setup event listeners
            document.getElementById('filter-folders-sort')?.addEventListener('change', () => this.renderFolderCards());
            document.getElementById('filter-folders-search')?.addEventListener('input', () => this.renderFolderCards());

        } catch (error) {
            console.error('Error loading folders:', error);
            document.getElementById('folders-grid').innerHTML =
                '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#e74c3c;">Error cargando carpetas</div>';
        }
    }

    renderFolderCards() {
        const grid = document.getElementById('folders-grid');
        if (!this.foldersData) return;

        // Obtener filtros
        const sortBy = document.getElementById('filter-folders-sort')?.value || 'name';
        const searchTerm = document.getElementById('filter-folders-search')?.value.toLowerCase() || '';

        // Filtrar
        let filtered = this.foldersData.filter(folder =>
            folder.name.toLowerCase().includes(searchTerm)
        );

        // Ordenar
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'count':
                    return (b.hallazgos.length + b.fragmentos.length) - (a.hallazgos.length + a.fragmentos.length);
                case 'activity':
                    return (b.lastActivity || 0) - (a.lastActivity || 0);
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });

        // Renderizar
        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#999;">No se encontraron carpetas</div>';
            return;
        }

        grid.innerHTML = filtered.map(folder => `
            <div class="folder-card">
                <div class="folder-icon">📁</div>
                <h3>${this.escapeHtml(folder.name)}</h3>
                <div class="folder-stats-preview">
                    <span>📍 ${folder.hallazgos.length} hallazgos</span>
                    <span>🦴 ${folder.fragmentos.length} fragmentos</span>
                    <span>👥 ${folder.collectors.length} colectores</span>
                </div>
                <div class="folder-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.adminPanel.showFolderDetails('${this.escapeHtml(folder.name)}')">
                        Ver Detalles
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.adminPanel.showFolderOnMap('${this.escapeHtml(folder.name)}')">
                        Ver en Mapa
                    </button>
                </div>
            </div>
        `).join('');
    }

    showFolderDetails(folderName) {
        const folder = this.foldersData.find(f => f.name === folderName);
        if (!folder) return;

        // Guardar carpeta actual
        this.currentFolder = folder;

        // Actualizar título
        document.getElementById('folder-modal-title').textContent = `📁 ${folderName}`;

        // Mostrar estadísticas
        const statsDiv = document.getElementById('folder-stats-summary');
        statsDiv.innerHTML = `
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value">${folder.hallazgos.length}</div>
                    <div class="stat-label">Hallazgos</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${folder.fragmentos.length}</div>
                    <div class="stat-label">Fragmentos</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${folder.collectors.length}</div>
                    <div class="stat-label">Colectores</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Colectores:</div>
                    <div class="stat-value" style="font-size:14px;">${folder.collectors.join(', ')}</div>
                </div>
            </div>
        `;

        // Mostrar tab de hallazgos por defecto
        this.showFolderTab('folder-hallazgos');

        // Setup tab buttons
        document.querySelectorAll('#modal-folder-details .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#modal-folder-details .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.showFolderTab(btn.dataset.tab);
            });
        });

        // Mostrar modal
        document.getElementById('modal-folder-details').style.display = 'flex';
    }

    showFolderTab(tabName) {
        const content = document.getElementById('folder-tab-content');
        const folder = this.currentFolder;

        if (tabName === 'folder-hallazgos') {
            if (folder.hallazgos.length === 0) {
                content.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No hay hallazgos en esta carpeta</p>';
                return;
            }

            content.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Foto</th>
                            <th>Fecha</th>
                            <th>Código</th>
                            <th>Tipo</th>
                            <th>Localidad</th>
                            <th>Colector</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${folder.hallazgos.map(h => {
                const foto = h.foto1 || h.foto2 || h.foto3;
                const fotoHTML = foto ?
                    `<img src="${foto}" alt="Foto" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">` :
                    '<span style="color:#999;">-</span>';
                const collectorName = h.collector?.name || h.collector?.collectorId || 'N/A';

                return `
                                <tr>
                                    <td>${fotoHTML}</td>
                                    <td>${h.fecha || 'N/A'}</td>
                                    <td>${h.codigo || 'N/A'}</td>
                                    <td>${h.tipo_material || 'N/A'}</td>
                                    <td>${h.localidad || 'N/A'}</td>
                                    <td>${collectorName}</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            `;
        } else if (tabName === 'folder-fragmentos') {
            if (folder.fragmentos.length === 0) {
                content.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No hay fragmentos en esta carpeta</p>';
                return;
            }

            content.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Localidad</th>
                            <th>Observaciones</th>
                            <th>Colector</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${folder.fragmentos.map(f => {
                const collectorName = f.collector?.name || f.collector?.collectorId || 'N/A';

                return `
                                <tr>
                                    <td>${f.fecha || 'N/A'}</td>
                                    <td>${f.localidad || 'N/A'}</td>
                                    <td>${f.observaciones || '-'}</td>
                                    <td>${collectorName}</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    showFolderOnMap(folderName) {
        // Cambiar a vista de mapa
        this.loadView('map');

        // Esperar a que el mapa se cargue
        setTimeout(() => {
            // Aplicar filtro de carpeta
            const folderSelect = document.getElementById('filter-map-folder');
            if (folderSelect) {
                folderSelect.value = folderName;
                this.updateMap();
            }
        }, 500);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    async exportCSV(type) {
        await this.exportToExcelWithImages(type);
    }

    async exportToExcelWithImages(type) {
        try {
            if (typeof ExcelJS === 'undefined') {
                alert('La librería ExcelJS no está cargada. Por favor recarga la página.');
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(type === 'hallazgos' ? 'Hallazgos' : 'Fragmentos');

            let data;
            const response = await this.apiRequest(`/api/admin/${type}`);
            data = response.data;

            if (!data || data.length === 0) {
                alert(`No hay ${type} para exportar`);
                return;
            }

            // Define columns
            const columns = [];
            if (type === 'hallazgos') {
                columns.push(
                    { header: 'Foto', key: 'foto', width: 15 },
                    { header: 'Fecha', key: 'fecha', width: 12 },
                    { header: 'Código', key: 'codigo', width: 15 },
                    { header: 'Tipo', key: 'tipo', width: 15 },
                    { header: 'Colector', key: 'colector', width: 15 },
                    { header: 'Localidad', key: 'localidad', width: 15 },
                    { header: 'Carpeta', key: 'carpeta', width: 15 },
                    { header: 'Coordenadas', key: 'coordenadas', width: 25 },
                    { header: 'Observaciones', key: 'observaciones', width: 30 }
                );
            } else {
                columns.push(
                    { header: 'Foto', key: 'foto', width: 15 },
                    { header: 'Fecha', key: 'fecha', width: 12 },
                    { header: 'Colector', key: 'colector', width: 15 },
                    { header: 'Localidad', key: 'localidad', width: 15 },
                    { header: 'Carpeta', key: 'carpeta', width: 15 },
                    { header: 'Coordenadas', key: 'coordenadas', width: 25 },
                    { header: 'Observaciones', key: 'observaciones', width: 30 }
                );
            }
            worksheet.columns = columns;

            // Add rows and images
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const rowValues = {};

                // Common fields
                rowValues.fecha = item.fecha || '';
                rowValues.colector = item.collector?.name || item.collector?.collectorId || '';
                rowValues.localidad = item.localidad || '';
                rowValues.carpeta = item.folder || '';
                rowValues.coordenadas = item.lat && item.lng ? `${item.lat}, ${item.lng}` : '';
                rowValues.observaciones = item.observaciones || '';

                // Type specific
                if (type === 'hallazgos') {
                    rowValues.codigo = item.codigo || '';
                    rowValues.tipo = item.tipo_material || '';
                }

                const row = worksheet.addRow(rowValues);
                row.height = 60; // Make row taller for image

                // Handle Image
                const fotoBase64 = type === 'hallazgos' ? (item.foto1 || item.foto2 || item.foto3) : item.foto;

                if (fotoBase64 && fotoBase64.startsWith('data:image')) {
                    try {
                        const imageId = workbook.addImage({
                            base64: fotoBase64,
                            extension: 'jpeg',
                        });

                        worksheet.addImage(imageId, {
                            tl: { col: 0, row: row.number - 1 }, // Column A (0)
                            ext: { width: 80, height: 80 },
                            editAs: 'oneCell'
                        });
                    } catch (e) {
                        console.error('Error adding image to excel', e);
                    }
                }
            }

            // Export
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `${type}_con_fotos_${new Date().toISOString().slice(0, 10)}.xlsx`);

        } catch (error) {
            console.error('Error exporting Excel with images:', error);
            alert('Error al exportar Excel: ' + error.message);
        }
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

    updateFilterSummary(view, filteredCount, totalCount) {
        const summaryElement = document.getElementById(`filter-${view}-summary`);
        if (!summaryElement) return;

        const activeFilters = this.filterManager.getActiveFiltersText();

        if (activeFilters.length === 0) {
            summaryElement.innerHTML = '';
            return;
        }

        const filtersHTML = activeFilters.map(filter =>
            `<span class="filter-tag">${filter}</span>`
        ).join('');

        summaryElement.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>Filtros activos:</strong> ${filtersHTML}
            </div>
            <div>
                Mostrando <strong>${filteredCount}</strong> de <strong>${totalCount}</strong> resultados
            </div>
        `;
    }

    clearHallazgosFilters() {
        // Clear filter manager
        this.filterManager.clearFilters();

        // Clear UI inputs
        const searchInput = document.getElementById('filter-hallazgos-search');
        const dateFromInput = document.getElementById('filter-hallazgos-date-from');
        const dateToInput = document.getElementById('filter-hallazgos-date-to');

        if (searchInput) searchInput.value = '';
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';

        // Reload data
        this.loadHallazgos();
    }

    editHallazgo(hallazgoId) {
        try {
            // Buscar hallazgo en los datos actuales
            const hallazgo = this.currentHallazgos && this.currentHallazgos.find(h => String(h.id) === String(hallazgoId));

            if (!hallazgo) {
                alert('Hallazgo no encontrado');
                return;
            }

            // Prellenar formulario
            document.getElementById('edit-hallazgo-id').value = hallazgo.id;
            document.getElementById('edit-codigo').value = hallazgo.codigo || '';
            document.getElementById('edit-tipo-material').value = hallazgo.tipo_material || '';
            document.getElementById('edit-localidad').value = hallazgo.localidad || '';
            document.getElementById('edit-formacion').value = hallazgo.formacion || '';
            document.getElementById('edit-lat').value = hallazgo.lat || '';
            document.getElementById('edit-lng').value = hallazgo.lng || '';
            document.getElementById('edit-folder').value = hallazgo.folder || '';
            document.getElementById('edit-observaciones').value = hallazgo.observaciones || '';

            // Abrir modal
            document.getElementById('modal-edit-hallazgo').style.display = 'flex';

        } catch (error) {
            console.error('Error editing hallazgo:', error);
            alert('Error al abrir editor');
        }
    }

    async handleEditHallazgo(e) {
        e.preventDefault();

        const hallazgoId = document.getElementById('edit-hallazgo-id').value;

        const updatedData = {
            codigo: document.getElementById('edit-codigo').value,
            tipo_material: document.getElementById('edit-tipo-material').value,
            localidad: document.getElementById('edit-localidad').value,
            formacion: document.getElementById('edit-formacion').value,
            lat: parseFloat(document.getElementById('edit-lat').value),
            lng: parseFloat(document.getElementById('edit-lng').value),
            folder: document.getElementById('edit-folder').value,
            observaciones: document.getElementById('edit-observaciones').value
        };

        try {
            const response = await this.apiRequest(`/api/admin/hallazgos/${hallazgoId}`, {
                method: 'PUT',
                body: JSON.stringify(updatedData)
            });

            if (response.success) {
                alert('✅ Hallazgo actualizado exitosamente');
                document.getElementById('modal-edit-hallazgo').style.display = 'none';
                this.loadHallazgos(); // Recargar tabla
            } else {
                alert('❌ Error al actualizar: ' + (response.error || 'Desconocido'));
            }

        } catch (error) {
            console.error('Error updating hallazgo:', error);
            alert('❌ Error de conexión al actualizar');
        }
    }

    // Download individual photo
    downloadPhoto(base64Data, filename) {
        try {
            // Convert base64 to blob
            const byteCharacters = atob(base64Data.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading photo:', error);
            alert('Error al descargar la foto');
        }
    }

    // Edit fragmento (placeholder for future implementation)
    editFragmento(fragmentoId) {
        const fragmento = this.currentFragmentos && this.currentFragmentos.find(f => String(f.id) === String(fragmentoId));

        if (!fragmento) {
            alert('Fragmento no encontrado');
            return;
        }

        const info = `
=== DATOS PARA EDICIÓN MANUAL ===
ID: ${fragmento.id}
Fecha: ${fragmento.fecha}
Colector: ${fragmento.collectorId}
Localidad: ${fragmento.localidad}
Carpeta: ${fragmento.folder}
Observaciones: ${fragmento.observaciones}
Lat/Lng: ${fragmento.lat}, ${fragmento.lng}

* Copia estos datos si necesitas editarlos en la base de datos *
(Edición completa en desarrollo)
        `;
        alert(info);
    }



}

// Initialize the admin panel
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel; // Expose globally for onclick handlers
