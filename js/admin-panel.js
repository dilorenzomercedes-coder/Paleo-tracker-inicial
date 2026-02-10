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

        // Define color palettes
        this.colorPalettes = {
            vibrant: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'
            ],
            pastel: [
                '#FFB3BA', '#BAE1FF', '#FFFFBA', '#BAFFC9', '#E0BBE4',
                '#FFDFBA', '#C9E4DE', '#FFC8DD', '#BDE0FE', '#A0C4FF'
            ],
            earth: [
                '#8B4513', '#D2691E', '#CD853F', '#DEB887', '#F4A460',
                '#BC8F8F', '#A0522D', '#C19A6B', '#E97451', '#DD7540'
            ],
            ocean: [
                '#006994', '#00A8E1', '#00C2F9', '#66D3F9', '#99E1F9',
                '#0077BE', '#48A9C5', '#72DDF7', '#0096C7', '#00B4D8'
            ]
        };

        // Default palette for each chart
        this.chartPalettes = {
            carpeta: 'vibrant',
            material: 'vibrant',
            formacion: 'vibrant',
            taxonomica: 'vibrant',
            accion: 'vibrant',
            temporal: 'vibrant',
            concentration: 'vibrant'
        };

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
        document.getElementById('btn-export-kml-all')?.addEventListener('click', () => {
            const folder = document.getElementById('filter-kml-folder')?.value || '';
            this.exportKML('', folder);
        });
        document.getElementById('btn-export-json-backup')?.addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-export-excel-hallazgos')?.addEventListener('click', () => this.exportExcel('hallazgos'));
        document.getElementById('btn-export-excel-fragmentos')?.addEventListener('click', () => this.exportExcel('fragmentos'));
        document.getElementById('btn-download-photos')?.addEventListener('click', () => this.downloadPhotosByFolder());
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

        // Setup palette selectors
        this.setupPaletteListeners();
    }

    setupPaletteListeners() {
        document.querySelectorAll('.palette-selector').forEach(selector => {
            selector.addEventListener('change', (e) => {
                const chartName = e.target.dataset.chart;
                const palette = e.target.value;

                this.chartPalettes[chartName] = palette;

                // Re-render the chart with new palette
                switch (chartName) {
                    case 'material':
                        if (this.tipoMaterialData) {
                            const folder = document.getElementById('filter-material-folder')?.value || '';
                            this.renderTipoMaterialChart(folder);
                        }
                        break;
                    case 'formacion':
                        if (this.formacionData) {
                            const folder = document.getElementById('filter-formacion-folder')?.value || '';
                            this.renderFormacionGeologicaChart(folder);
                        }
                        break;
                    case 'taxonomica':
                        if (this.taxonomicaData) {
                            const folder = document.getElementById('filter-taxonomica-folder')?.value || '';
                            this.renderClasificacionTaxonomicaChart(folder);
                        }
                        break;
                    case 'accion':
                        if (this.accionData) {
                            const folder = document.getElementById('filter-accion-folder')?.value || '';
                            this.renderAccionChart(folder);
                        }
                        break;
                    case 'temporal':
                        if (this.tendenciaTemporalData) {
                            const period = document.getElementById('period-temporal')?.value || 'month';
                            this.renderTendenciaTemporalChart(period);
                        }
                        break;
                }
            });
        });
    }

    openColorPicker(chartName, label, datasetIndex) {
        // Store current selection
        this.currentColorSelection = {
            chartName,
            label,
            datasetIndex
        };

        // Set label text
        document.getElementById('color-picker-label').textContent = `Color para: ${label}`;

        // Get current color
        let currentColor = '#FF6384'; // default
        if (this.customChartColors && this.customChartColors[chartName] && this.customChartColors[chartName][label]) {
            currentColor = this.customChartColors[chartName][label];
        }

        // Set color picker to current color
        document.getElementById('color-picker-input').value = currentColor;

        // Setup apply button
        const applyBtn = document.getElementById('btn-apply-color');
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);

        newApplyBtn.addEventListener('click', () => {
            this.applyCustomColor();
        });

        // Setup cancel and close buttons
        const modal = document.getElementById('modal-color-picker');
        const closeButtons = modal.querySelectorAll('[data-close-modal]');
        closeButtons.forEach(btn => {
            // Remove old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            // Add new listener
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeModal('modal-color-picker');
            });
        });

        // Show modal
        this.openModal('modal-color-picker');
    }

    applyCustomColor() {
        const color = document.getElementById('color-picker-input').value;
        const { chartName, label, datasetIndex } = this.currentColorSelection;

        // Initialize custom colors storage
        if (!this.customChartColors) {
            this.customChartColors = {};
        }
        if (!this.customChartColors[chartName]) {
            this.customChartColors[chartName] = {};
        }

        // Store custom color
        this.customChartColors[chartName][label] = color;

        // Re-render charts with filters to apply custom colors
        if (chartName === 'temporal' && this.tendenciaTemporalData) {
            const period = document.getElementById('period-temporal')?.value || 'month';
            this.renderTendenciaTemporalChart(period);
        } else if (chartName === 'material' && this.tipoMaterialData) {
            const folderFilter = document.getElementById('filter-material-folder')?.value || '';
            this.renderTipoMaterialChart(folderFilter);
        } else if (chartName === 'formacion' && this.formacionData) {
            const folderFilter = document.getElementById('filter-formacion-folder')?.value || '';
            this.renderFormacionGeologicaChart(folderFilter);
        } else if (chartName === 'taxonomica' && this.taxonomicaData) {
            const folderFilter = document.getElementById('filter-taxonomica-folder')?.value || '';
            this.renderClasificacionTaxonomicaChart(folderFilter);
        } else if (chartName === 'accion' && this.accionData) {
            const folderFilter = document.getElementById('filter-accion-folder')?.value || '';
            this.renderAccionChart(folderFilter);
        } else if (chartName === 'concentracion' && this.concentracionData) {
            const folderFilter = document.getElementById('filter-concentration-folder')?.value || '';
            this.renderConcentracionChart(folderFilter);
        } else if (chartName === 'carpeta') {
            // For bar charts without filters, update directly
            const canvas = document.getElementById('chart-por-carpeta');
            if (canvas) {
                const chartInstance = Chart.getChart(canvas);
                if (chartInstance) {
                    // For bar charts, update the specific bar color
                    const labelIndex = chartInstance.data.labels.indexOf(label);
                    if (labelIndex !== -1 && chartInstance.data.datasets[0]) {
                        // Create new arrays to trigger Chart.js update
                        const newBackgroundColors = [...chartInstance.data.datasets[0].backgroundColor];
                        const newBorderColors = [...chartInstance.data.datasets[0].borderColor];

                        newBackgroundColors[labelIndex] = color;
                        newBorderColors[labelIndex] = color;

                        chartInstance.data.datasets[0].backgroundColor = newBackgroundColors;
                        chartInstance.data.datasets[0].borderColor = newBorderColors;
                        chartInstance.update();
                    }
                }
            }
        }

        // Close modal
        this.closeModal('modal-color-picker');
    }

    // Helper function to enable color picking on any Chart.js instance
    enableChartColorPicking(chartInstance, chartName) {
        if (!chartInstance || !chartInstance.options) return;

        // Add onClick to legend
        if (!chartInstance.options.plugins) {
            chartInstance.options.plugins = {};
        }
        if (!chartInstance.options.plugins.legend) {
            chartInstance.options.plugins.legend = {};
        }

        chartInstance.options.plugins.legend.onClick = (e, legendItem, legend) => {
            this.openColorPicker(chartName, legendItem.text, legendItem.datasetIndex);
        };

        chartInstance.options.plugins.legend.onHover = (e) => {
            e.native.target.style.cursor = 'pointer';
        };

        chartInstance.options.plugins.legend.onLeave = (e) => {
            e.native.target.style.cursor = 'default';
        };

        // Update the chart to apply new options
        chartInstance.update();
    }

    // Function to make all existing charts color-pickable
    makeAllChartsColorPickable() {
        // This will be called after charts are created
        setTimeout(() => {
            const canvasElements = [
                { id: 'chart-por-carpeta', name: 'carpeta' },
                { id: 'chart-tipos-material', name: 'material' },
                { id: 'chart-formacion', name: 'formacion' },
                { id: 'chart-taxonomia', name: 'taxonomica' },
                { id: 'chart-accion', name: 'accion' },
                { id: 'chart-concentration', name: 'concentration' }
            ];

            canvasElements.forEach(({ id, name }) => {
                const canvas = document.getElementById(id);
                if (canvas) {
                    // Use Chart.js V4 API to get chart instance
                    const chartInstance = Chart.getChart(canvas);
                    if (chartInstance) {
                        this.enableChartColorPicking(chartInstance, name);
                    }
                }
            });
        }, 1000); // Increased timeout to ensure charts are loaded
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
            case 'export':
                this.loadExportFilters();
                break;
            case 'statistics':
                this.loadStatistics();
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
        } catch (error) {
            console.error('Error loading overview:', error);
        }
    }

    async loadStatistics() {
        // Load charts data
        await this.loadChartsData();
        // Setup color change listeners
        this.setupColorChangeListeners();
    }

    async loadChartsData() {
        try {
            // Fetch all data for charts
            const [hallazgosRes, fragmentosRes] = await Promise.all([
                this.apiRequest('/api/admin/hallazgos'),
                this.apiRequest('/api/admin/fragmentos')
            ]);

            const hallazgos = hallazgosRes.data;
            const fragmentos = fragmentosRes.data;

            console.log('=== LOADING CHARTS DATA ===');
            console.log('Total hallazgos:', hallazgos.length);
            console.log('Total fragmentos:', fragmentos.length);

            // Show sample data
            if (hallazgos.length > 0) {
                console.log('Sample hallazgo:', hallazgos[0]);
                console.log('All localidades in hallazgos:', [...new Set(hallazgos.map(h => h.localidad))]);
            }
            if (fragmentos.length > 0) {
                console.log('Sample fragmento:', fragmentos[0]);
                console.log('All localidades in fragmentos:', [...new Set(fragmentos.map(f => f.localidad))]);
            }

            // Create charts
            this.createHallazgosPorCarpetaChart(hallazgos);
            this.createTipoMaterialChart(hallazgos);
            this.createFormacionGeologicaChart(hallazgos);
            this.createClasificacionTaxonomicaChart(hallazgos);
            this.createAccionChart(hallazgos);
            this.createTendenciaTemporalChart(hallazgos);
            this.createConcentracionChart(hallazgos, fragmentos);

            // Populate concentration folder filter
            this.populateConcentrationFolderFilter(hallazgos, fragmentos);
        } catch (error) {
            console.error('Error loading charts data:', error);
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

            // Store for export and photo viewing
            this.currentHallazgos = rawData.data;

            if (rawData.data.length === 0) {
                document.getElementById('hallazgos-table-body').innerHTML = '<tr><td colspan="9">No hay hallazgos</td></tr>';
                return;
            }

            // Client-side filtering
            this.filterManager.setFilter('collector', collector);
            this.filterManager.setFilter('folder', folder);
            const filteredData = this.filterManager.applyFilters(rawData.data);

            // Update filter summary
            this.updateFilterSummary('hallazgos', filteredData.length, rawData.data.length);

            const tbody = document.getElementById('hallazgos-table-body');

            if (filteredData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9">No hay resultados para los filtros aplicados</td></tr>';
                return;
            }

            tbody.innerHTML = filteredData.map(h => {
                // Check for any of the photo fields (foto1, foto2, foto3)
                const foto = h.foto1 || h.foto2 || h.foto3;
                // Use ID for onclick to avoid passing massive base64 string
                const fotoHTML = foto ?
                    `<img src="${foto}" alt="Foto" style="width:60px;height:60px;object-fit:cover;cursor:pointer;border-radius:4px;" onclick="window.adminPanel.viewPhotoById('${h.id}', 'hallazgo')">` :
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

            // Store current data for export and photos
            this.currentFragmentos = data.data;

            tbody.innerHTML = data.data.map(f => {
                // Display photo if available
                const foto = f.foto;
                // Use ID for onclick
                const fotoHTML = foto ?
                    `<img src="${foto}" alt="Foto" style="width:60px;height:60px;object-fit:cover;cursor:pointer;border-radius:4px;" onclick="window.adminPanel.viewPhotoById('${f.id}', 'fragmento')">` :
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
            ${foto ? `<button class="btn-icon" onclick="window.adminPanel.downloadPhotoById('${f.id}', 'fragmento')" title="Descargar foto">📥</button>` : ''}
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

                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: '© Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
                    maxZoom: 19
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

    // View photo by ID (more efficient than passing base64 in HTML)
    viewPhotoById(id, type) {
        let item;
        let title;
        let foto;

        if (type === 'hallazgo') {
            item = this.currentHallazgos && this.currentHallazgos.find(h => String(h.id) === String(id));
            if (item) {
                foto = item.foto1 || item.foto2 || item.foto3;
                title = item.codigo || 'Hallazgo';
            }
        } else if (type === 'fragmento') {
            item = this.currentFragmentos && this.currentFragmentos.find(f => String(f.id) === String(id));
            if (item) {
                foto = item.foto;
                title = `Fragmento - ${item.folder}`;
            }
        }

        if (foto) {
            this.viewPhoto(foto, title);
        } else {
            alert('Foto no encontrada');
        }
    }

    // View photo in modal
    viewPhoto(base64, title) {
        const modal = document.getElementById('modal-photo');
        const img = document.getElementById('modal-photo-img');
        const caption = document.getElementById('modal-photo-caption');

        img.src = base64;
        caption.textContent = title;
        modal.style.display = 'block';
    }

    // Download photo by ID
    downloadPhotoById(id, type) {
        let item;
        let filename;
        let foto;

        if (type === 'hallazgo') {
            // Not implemented for hallazgo individual download yet, but preparing structure
            item = this.currentHallazgos && this.currentHallazgos.find(h => String(h.id) === String(id));
            if (item) {
                foto = item.foto1 || item.foto2 || item.foto3;
                filename = `hallazgo_${item.codigo}.jpg`;
            }
        } else if (type === 'fragmento') {
            item = this.currentFragmentos && this.currentFragmentos.find(f => String(f.id) === String(id));
            if (item) {
                foto = item.foto;
                filename = `fragmento_${item.folder || 'img'}_${item.fecha || 'date'}.jpg`;
            }
        }

        if (foto) {
            this.downloadPhoto(foto, filename);
        } else {
            alert('Foto no encontrada para descargar');
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

    // Edit fragmento
    editFragmento(fragmentoId) {
        try {
            // Buscar fragmento en los datos actuales
            const fragmento = this.currentFragmentos && this.currentFragmentos.find(f => String(f.id) === String(fragmentoId));

            if (!fragmento) {
                alert('Fragmento no encontrado');
                return;
            }

            // Prellenar formulario
            document.getElementById('edit-fragmento-id').value = fragmento.id;
            document.getElementById('edit-fragmento-fecha').value = fragmento.fecha || '';
            document.getElementById('edit-fragmento-localidad').value = fragmento.localidad || '';
            document.getElementById('edit-fragmento-folder').value = fragmento.folder || '';
            document.getElementById('edit-fragmento-lat').value = fragmento.lat || '';
            document.getElementById('edit-fragmento-lng').value = fragmento.lng || '';
            document.getElementById('edit-fragmento-observaciones').value = fragmento.observaciones || '';

            // Abrir modal
            document.getElementById('modal-edit-fragmento').style.display = 'flex';

        } catch (error) {
            console.error('Error editing fragmento:', error);
            alert('Error al abrir editor');
        }
    }

    // Handle edit fragmento form submission
    async handleEditFragmento(e) {
        e.preventDefault();

        const fragmentoId = document.getElementById('edit-fragmento-id').value;

        const updatedData = {
            fecha: document.getElementById('edit-fragmento-fecha').value,
            localidad: document.getElementById('edit-fragmento-localidad').value,
            folder: document.getElementById('edit-fragmento-folder').value,
            lat: parseFloat(document.getElementById('edit-fragmento-lat').value) || null,
            lng: parseFloat(document.getElementById('edit-fragmento-lng').value) || null,
            observaciones: document.getElementById('edit-fragmento-observaciones').value
        };

        try {
            const response = await this.apiRequest(`/api/admin/fragmentos/${fragmentoId}`, {
                method: 'PUT',
                body: JSON.stringify(updatedData)
            });

            if (response.success) {
                alert('✅ Fragmento actualizado exitosamente');
                document.getElementById('modal-edit-fragmento').style.display = 'none';
                this.loadFragmentos(); // Recargar tabla
            } else {
                alert('❌ Error al actualizar: ' + (response.error || 'Desconocido'));
            }

        } catch (error) {
            console.error('Error updating fragmento:', error);
            alert('❌ Error de conexión al actualizar');
        }
    }

    // Export to Excel with embedded images
    async exportExcel(type) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(type === 'hallazgos' ? 'Hallazgos' : 'Fragmentos');

            // Always fetch fresh data from API to ensure photos are included
            console.log(`Fetching fresh ${type} data for Excel export...`);
            const response = await this.apiRequest(type === 'hallazgos' ? '/api/admin/hallazgos' : '/api/admin/fragmentos');
            let data = response.data;
            console.log(`Fetched ${data.length} ${type}, first item has foto:`, !!data[0]?.foto);

            // Get selected folder filter
            const folderFilter = type === 'hallazgos'
                ? document.getElementById('filter-excel-hallazgos-folder')?.value
                : document.getElementById('filter-excel-fragmentos-folder')?.value;

            // Filter by folder if selected
            if (folderFilter) {
                data = data.filter(item => item.folder === folderFilter);
                console.log(`Filtered to ${data.length} ${type} in folder "${folderFilter}"`);
            }

            if (!data || data.length === 0) {
                alert('No hay datos para exportar.');
                return;
            }

            // Configure columns based on type
            if (type === 'hallazgos') {
                worksheet.columns = [
                    { header: 'Código', key: 'codigo', width: 15 },
                    { header: 'Tipo Material', key: 'tipo_material', width: 20 },
                    { header: 'Localidad', key: 'localidad', width: 20 },
                    { header: 'Formación', key: 'formacion', width: 20 },
                    { header: 'Carpeta', key: 'folder', width: 15 },
                    { header: 'Latitud', key: 'lat', width: 12 },
                    { header: 'Longitud', key: 'lng', width: 12 },
                    { header: 'Observaciones', key: 'observaciones', width: 30 },
                    { header: 'Colector', key: 'collector', width: 15 },
                    { header: 'Fecha', key: 'fecha', width: 12 },
                    { header: 'Foto', key: 'foto', width: 20 }
                ];
            } else {
                worksheet.columns = [
                    { header: 'Localidad', key: 'localidad', width: 20 },
                    { header: 'Carpeta', key: 'folder', width: 15 },
                    { header: 'Latitud', key: 'lat', width: 12 },
                    { header: 'Longitud', key: 'lng', width: 12 },
                    { header: 'Observaciones', key: 'observaciones', width: 30 },
                    { header: 'Colector', key: 'collector', width: 15 },
                    { header: 'Fecha', key: 'fecha', width: 12 },
                    { header: 'Foto', key: 'foto', width: 20 }
                ];
            }

            // Style header
            worksheet.getRow(1).font = { bold: true, size: 12 };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4CAF50' }
            };

            // Add data rows
            let rowIndex = 2;
            for (const item of data) {
                const rowData = type === 'hallazgos' ? {
                    codigo: item.codigo || '',
                    tipo_material: item.tipo_material || '',
                    localidad: item.localidad || '',
                    formacion: item.formacion || '',
                    folder: item.folder || '',
                    lat: item.lat || '',
                    lng: item.lng || '',
                    observaciones: item.observaciones || '',
                    collector: item.collector?.name || item.collector?.collectorId || '',
                    fecha: item.fecha || ''
                } : {
                    localidad: item.localidad || '',
                    folder: item.folder || '',
                    lat: item.lat || '',
                    lng: item.lng || '',
                    observaciones: item.observaciones || '',
                    collector: item.collector?.name || item.collector?.collectorId || '',
                    fecha: item.fecha || ''
                };

                const row = worksheet.addRow(rowData);
                row.height = 80; // Make rows taller for images

                // Add image if exists (hallazgos use foto1, fragmentos use foto)
                const photoField = type === 'hallazgos' ? item.foto1 : item.foto;
                if (photoField) {
                    try {
                        console.log(`Processing image for ${type} at row ${rowIndex}, has photo:`, !!photoField);
                        // Convert base64 to buffer
                        const base64Data = photoField.replace(/^data:image\/\w+;base64,/, '');
                        const imageId = workbook.addImage({
                            base64: base64Data,
                            extension: 'jpeg',
                        });

                        // Add image to cell
                        const colIndex = type === 'hallazgos' ? 10 : 7; // Photo column (0-indexed)
                        worksheet.addImage(imageId, {
                            tl: { col: colIndex, row: rowIndex - 1 },
                            ext: { width: 100, height: 75 }
                        });
                        console.log(`Image added successfully at col ${colIndex}, row ${rowIndex - 1}`);
                    } catch (error) {
                        console.error('Error adding image to row:', error);
                        row.getCell(type === 'hallazgos' ? 11 : 8).value = 'Error cargando imagen';
                    }
                } else {
                    console.log(`No foto for ${type} at row ${rowIndex}`);
                }

                rowIndex++;
            }

            // Generate Excel file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);

            alert(`✅ Excel exportado exitosamente con ${data.length} registros`);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('❌ Error al exportar a Excel: ' + error.message);
        }
    }

    // Load export filters (populate folder dropdown)
    async loadExportFilters() {
        try {
            // Get all hallazgos and fragmentos to extract folders
            const [hallazgosData, fragmentosData] = await Promise.all([
                this.apiRequest('/api/admin/hallazgos'),
                this.apiRequest('/api/admin/fragmentos')
            ]);

            // Store data for Excel export (with photos)
            this.currentHallazgos = hallazgosData.data;
            this.currentFragmentos = fragmentosData.data;
            console.log('Loaded data for export:', hallazgosData.data.length, 'hallazgos,', fragmentosData.data.length, 'fragmentos');

            // Extract unique folder names
            const folders = new Set();
            hallazgosData.data.forEach(h => {
                if (h.folder) folders.add(h.folder);
            });
            fragmentosData.data.forEach(f => {
                if (f.folder) folders.add(f.folder);
            });

            const sortedFolders = Array.from(folders).sort();

            // Populate all folder dropdowns
            const dropdowns = [
                'filter-photos-folder',
                'filter-kml-folder',
                'filter-excel-hallazgos-folder',
                'filter-excel-fragmentos-folder'
            ];

            dropdowns.forEach(dropdownId => {
                const select = document.getElementById(dropdownId);
                if (select) {
                    select.innerHTML = '<option value="">Todas las carpetas</option>';
                    sortedFolders.forEach(folder => {
                        const option = document.createElement('option');
                        option.value = folder;
                        option.textContent = folder;
                        select.appendChild(option);
                    });
                }
            });
        } catch (error) {
            console.error('Error loading export filters:', error);
        }
    }

    // View photo by ID in modal
    viewPhotoById(id, type) {
        try {
            // Find the item in cached data
            const data = type === 'hallazgo' ? this.currentHallazgos : this.currentFragmentos;
            const item = data.find(i => i.id === id);

            if (!item) {
                alert('No se encontró el elemento');
                return;
            }

            // Get the photo (hallazgos have foto1/2/3, fragmentos have foto)
            const photo = type === 'hallazgo' ? (item.foto1 || item.foto2 || item.foto3) : item.foto;

            if (!photo) {
                alert('Este elemento no tiene foto');
                return;
            }

            // Set modal content
            document.getElementById('photo-viewer-title').textContent = type === 'hallazgo'
                ? `Foto ${item.codigo || item.id}`
                : `Foto ${item.localidad || item.id}`;
            document.getElementById('photo-viewer-image').src = photo;

            // Set download handler
            const downloadBtn = document.getElementById('btn-download-photo');
            downloadBtn.onclick = () => this.downloadPhoto(photo, type, item);

            // Show modal
            document.getElementById('modal-photo-viewer').style.display = 'flex';
        } catch (error) {
            console.error('Error viewing photo:', error);
            alert('Error al ver la foto');
        }
    }

    // Download individual photo
    downloadPhoto(photoBase64, type, item) {
        try {
            // Create filename
            const filename = type === 'hallazgo'
                ? `hallazgo_${item.codigo || item.id}_${item.fecha || 'sin_fecha'}.jpg`
                : `fragmento_${item.localidad || item.id}_${item.fecha || 'sin_fecha'}.jpg`;

            // Convert base64 to blob
            const base64Data = photoBase64.split(',')[1]; // Remove data:image/jpeg;base64, prefix
            const byteCharacters = atob(base64Data);
            const byteArrays = [];

            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                const slice = byteCharacters.slice(offset, offset + 512);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) {
                    byteNumbers[i] = slice.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }

            const blob = new Blob(byteArrays, { type: 'image/jpeg' });
            const url = window.URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();

            // Cleanup
            window.URL.revokeObjectURL(url);

            console.log(`Photo downloaded: ${filename}`);
        } catch (error) {
            console.error('Error downloading photo:', error);
            alert('Error al descargar la foto');
        }
    }

    // Download photos by folder
    async downloadPhotosByFolder() {
        try {
            const folder = document.getElementById('filter-photos-folder')?.value || '';
            const params = new URLSearchParams();
            if (folder) params.append('folder', folder);

            // Call backend endpoint
            this.downloadFile(`/api/admin/download/photos?${params}`, `fotos_${folder || 'todas'}_${new Date().toISOString().slice(0, 10)}.zip`);
        } catch (error) {
            console.error('Error downloading photos:', error);
            alert('Error descargando fotos');
        }
    }

    // CHARTS FUNCTIONS

    createHallazgosPorCarpetaChart(hallazgos) {
        const ctx = document.getElementById('chart-por-carpeta');
        if (!ctx) return;

        // Group by folder
        const byFolder = {};
        hallazgos.forEach(h => {
            const folder = h.folder || 'Sin carpeta';
            byFolder[folder] = (byFolder[folder] || 0) + 1;
        });

        // Destroy previous chart if exists
        if (this.chartPorCarpeta) {
            this.chartPorCarpeta.destroy();
        }

        // Multi-color palette for each folder
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
            '#36A2EB', '#FFCE56', '#E7E9ED', '#FF6384', '#36A2EB'
        ];

        // Apply custom colors if they exist
        const folders = Object.keys(byFolder);
        const backgroundColors = folders.map((folder, idx) =>
            this.customChartColors?.carpeta?.[folder] || colors[idx % colors.length]
        );

        this.chartPorCarpeta = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: folders,
                datasets: [{
                    label: 'Hallazgos',
                    data: Object.values(byFolder),
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                // Click on bars to pick color
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const element = activeElements[0];
                        const index = element.index;
                        const label = folders[index];
                        this.openColorPicker('carpeta', label, index);
                    }
                },
                onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                },
                plugins: {
                    legend: {
                        display: false // Hide legend for this chart type
                    },
                    tooltip: {
                        callbacks: {
                            footer: () => 'Click para cambiar color'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    createTipoMaterialChart(hallazgos) {
        const ctx = document.getElementById('chart-tipos-material');
        if (!ctx) return;

        // Store data for filtering
        this.tipoMaterialData = hallazgos;

        // Render with no filter initially
        this.renderTipoMaterialChart('');
    }

    renderTipoMaterialChart(folderFilter) {
        const ctx = document.getElementById('chart-tipos-material');
        if (!ctx || !this.tipoMaterialData) return;

        let hallazgos = this.tipoMaterialData;

        // Filter by folder if specified
        if (folderFilter) {
            hallazgos = hallazgos.filter(h => h.folder === folderFilter);
        }

        // Group by tipo_material
        const byTipo = {};
        hallazgos.forEach(h => {
            const tipo = h.tipo_material || 'Sin especificar';
            byTipo[tipo] = (byTipo[tipo] || 0) + 1;
        });

        // Destroy previous chart
        if (this.chartTipoMaterial) {
            this.chartTipoMaterial.destroy();
        }

        // Vibrant multi-color palette
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
            '#36A2EB', '#FFCE56', '#E7E9ED', '#FF6384', '#36A2EB'
        ];

        // Apply custom colors if they exist
        const tipos = Object.keys(byTipo);
        const backgroundColors = tipos.map((tipo, idx) =>
            this.customChartColors?.material?.[tipo] || colors[idx % colors.length]
        );

        this.chartTipoMaterial = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: tipos,
                datasets: [{
                    data: Object.values(byTipo),
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        onClick: (e, legendItem, legend) => {
                            this.openColorPicker('material', legendItem.text, legendItem.index);
                        },
                        onHover: (e) => {
                            e.native.target.style.cursor = 'pointer';
                        },
                        onLeave: (e) => {
                            e.native.target.style.cursor = 'default';
                        }
                    }
                }
            }
        });
    }

    // FORMACIÓN GEOLÓGICA CHART
    createFormacionGeologicaChart(hallazgos) {
        const ctx = document.getElementById('chart-formacion');
        if (!ctx) return;

        this.formacionData = hallazgos;
        this.renderFormacionGeologicaChart('');
    }

    renderFormacionGeologicaChart(folderFilter) {
        const ctx = document.getElementById('chart-formacion');
        if (!ctx || !this.formacionData) return;

        let hallazgos = this.formacionData;
        if (folderFilter) {
            hallazgos = hallazgos.filter(h => h.folder === folderFilter);
        }

        const byFormacion = {};
        hallazgos.forEach(h => {
            const formacion = h.formacion || 'Sin especificar';
            byFormacion[formacion] = (byFormacion[formacion] || 0) + 1;
        });

        console.log('=== FORMACIÓN GEOLÓGICA CHART ===');
        console.log('Total hallazgos:', hallazgos.length);
        if (hallazgos.length > 0) {
            console.log('Sample hallazgo:', hallazgos[0]);
            console.log('formacion values:', hallazgos.map(h => h.formacion).filter(Boolean));
        }
        console.log('Grouped by formacion:', byFormacion);


        if (this.chartFormacion) {
            this.chartFormacion.destroy();
        }

        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];

        // Apply custom colors if they exist
        const formaciones = Object.keys(byFormacion);
        const backgroundColors = formaciones.map((formacion, idx) =>
            this.customChartColors?.formacion?.[formacion] || colors[idx % colors.length]
        );

        this.chartFormacion = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: formaciones,
                datasets: [{
                    data: Object.values(byFormacion),
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        onClick: (e, legendItem, legend) => {
                            this.openColorPicker('formacion', legendItem.text, legendItem.index);
                        },
                        onHover: (e) => {
                            e.native.target.style.cursor = 'pointer';
                        },
                        onLeave: (e) => {
                            e.native.target.style.cursor = 'default';
                        }
                    }
                }
            }
        });
    }

    // CLASIFICACIÓN TAXONÓMICA CHART
    createClasificacionTaxonomicaChart(hallazgos) {
        const ctx = document.getElementById('chart-taxonomica');
        if (!ctx) return;

        this.taxonomicaData = hallazgos;
        this.renderClasificacionTaxonomicaChart('');
    }

    renderClasificacionTaxonomicaChart(folderFilter) {
        const ctx = document.getElementById('chart-taxonomica');
        if (!ctx || !this.taxonomicaData) return;

        let hallazgos = this.taxonomicaData;
        if (folderFilter) {
            hallazgos = hallazgos.filter(h => h.folder === folderFilter);
        }

        const byTaxonomica = {};
        hallazgos.forEach(h => {
            const taxonomica = h.taxonomia || 'Sin especificar';
            byTaxonomica[taxonomica] = (byTaxonomica[taxonomica] || 0) + 1;
        });

        console.log('=== CLASIFICACIÓN TAXONÓMICA CHART ===');
        console.log('Total hallazgos:', hallazgos.length);
        if (hallazgos.length > 0) {
            console.log('Sample hallazgo:', hallazgos[0]);
            console.log('taxonomia values:', hallazgos.map(h => h.taxonomia).filter(Boolean));
        }
        console.log('Grouped by taxonomica:', byTaxonomica);


        if (this.chartTaxonomica) {
            this.chartTaxonomica.destroy();
        }

        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];

        // Apply custom colors if they exist
        const taxonomias = Object.keys(byTaxonomica);
        const backgroundColors = taxonomias.map((taxonomica, idx) =>
            this.customChartColors?.taxonomica?.[taxonomica] || colors[idx % colors.length]
        );

        this.chartTaxonomica = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: taxonomias,
                datasets: [{
                    data: Object.values(byTaxonomica),
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        onClick: (e, legendItem, legend) => {
                            this.openColorPicker('taxonomica', legendItem.text, legendItem.index);
                        },
                        onHover: (e) => {
                            e.native.target.style.cursor = 'pointer';
                        },
                        onLeave: (e) => {
                            e.native.target.style.cursor = 'default';
                        }
                    }
                }
            }
        });
    }

    // ACCIÓN CHART
    createAccionChart(hallazgos) {
        const ctx = document.getElementById('chart-accion');
        if (!ctx) return;

        this.accionData = hallazgos;
        this.renderAccionChart('');
    }

    renderAccionChart(folderFilter) {
        const ctx = document.getElementById('chart-accion');
        if (!ctx || !this.accionData) return;

        let hallazgos = this.accionData;
        if (folderFilter) {
            hallazgos = hallazgos.filter(h => h.folder === folderFilter);
        }

        const byAccion = {};
        hallazgos.forEach(h => {
            const accion = h.accion || 'Sin especificar';
            byAccion[accion] = (byAccion[accion] || 0) + 1;
        });

        console.log('=== ACCIÓN CHART ===');
        console.log('Total hallazgos:', hallazgos.length);
        if (hallazgos.length > 0) {
            console.log('Sample hallazgo:', hallazgos[0]);
            console.log('accion values:', hallazgos.map(h => h.accion).filter(Boolean));
        }
        console.log('Grouped by accion:', byAccion);


        if (this.chartAccion) {
            this.chartAccion.destroy();
        }

        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];

        // Apply custom colors if they exist
        const acciones = Object.keys(byAccion);
        const backgroundColors = acciones.map((accion, idx) =>
            this.customChartColors?.accion?.[accion] || colors[idx % colors.length]
        );

        this.chartAccion = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: acciones,
                datasets: [{
                    data: Object.values(byAccion),
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        onClick: (e, legendItem, legend) => {
                            this.openColorPicker('accion', legendItem.text, legendItem.index);
                        },
                        onHover: (e) => {
                            e.native.target.style.cursor = 'pointer';
                        },
                        onLeave: (e) => {
                            e.native.target.style.cursor = 'default';
                        }
                    }
                }
            }
        });
    }

    createTendenciaTemporalChart(hallazgos) {
        const ctx = document.getElementById('chart-temporal');
        if (!ctx) return;

        // Store data
        this.tendenciaTemporalData = hallazgos;

        // Render with default period (month)
        this.renderTendenciaTemporalChart('month');

        // Add event listener for period selector
        const periodSelector = document.getElementById('period-temporal');

        if (periodSelector) {
            // Remove existing listener
            periodSelector.removeEventListener('change', this.periodChangeHandler);

            // Create new handler
            this.periodChangeHandler = (e) => {
                this.renderTendenciaTemporalChart(e.target.value);
            };

            // Add listener
            periodSelector.addEventListener('change', this.periodChangeHandler);
        }
    }

    renderTendenciaTemporalChart(period) {
        const ctx = document.getElementById('chart-temporal');
        if (!ctx || !this.tendenciaTemporalData) return;

        const hallazgos = this.tendenciaTemporalData;

        // Group by folder AND period (day/week/month)
        const byFolderAndPeriod = {};
        const allPeriods = new Set();
        const periodDates = {}; // Store actual dates for better labels

        hallazgos.forEach(h => {
            if (h.fecha) {
                const date = new Date(h.fecha);
                let periodKey;

                if (period === 'day') {
                    periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    periodDates[periodKey] = date;
                } else if (period === 'week') {
                    // Get week number and store the date of Monday of that week
                    const onejan = new Date(date.getFullYear(), 0, 1);
                    const weekNum = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
                    periodKey = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

                    // Calculate Monday of this week
                    const dayOfWeek = date.getDay();
                    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                    const monday = new Date(date.getFullYear(), date.getMonth(), diff);
                    periodDates[periodKey] = monday;
                } else { // month
                    periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    periodDates[periodKey] = new Date(date.getFullYear(), date.getMonth(), 1);
                }

                const folder = h.folder || 'Sin carpeta';
                allPeriods.add(periodKey);

                if (!byFolderAndPeriod[folder]) {
                    byFolderAndPeriod[folder] = {};
                }
                byFolderAndPeriod[folder][periodKey] = (byFolderAndPeriod[folder][periodKey] || 0) + 1;
            }
        });

        // Sort periods chronologically
        const sortedPeriods = Array.from(allPeriods).sort();
        const labels = sortedPeriods.map(p => {
            if (period === 'day') {
                const d = periodDates[p];
                return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
            } else if (period === 'week') {
                const d = periodDates[p];
                const endDate = new Date(d);
                endDate.setDate(d.getDate() + 6);
                return `${d.getDate()}/${d.getMonth() + 1} - ${endDate.getDate()}/${endDate.getMonth() + 1}`;
            } else { // month
                const [year, month] = p.split('-');
                const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                return `${monthNames[parseInt(month) - 1]} ${year}`;
            }
        });

        // Get selected color palette for temporal chart
        const paletteKey = this.chartPalettes['temporal'] || 'vibrant';
        const colors = this.colorPalettes[paletteKey];

        // Create a dataset for each folder (for stacked bar chart)
        const datasets = Object.keys(byFolderAndPeriod).map((folder, index) => {
            // Check if there's a custom color for this folder
            let color;
            if (this.customChartColors && this.customChartColors['temporal'] && this.customChartColors['temporal'][folder]) {
                color = this.customChartColors['temporal'][folder];
            } else {
                color = colors[index % colors.length];
            }

            const data = sortedPeriods.map(p => byFolderAndPeriod[folder][p] || 0);

            return {
                label: folder,
                data: data,
                backgroundColor: color,
                borderColor: color,
                borderWidth: 1
            };
        });

        // Destroy previous chart
        if (this.chartTemporal) {
            this.chartTemporal.destroy();
        }

        this.chartTemporal = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        onClick: (e, legendItem, legend) => {
                            // Open color picker for this legend item
                            this.openColorPicker('temporal', legendItem.text, legendItem.datasetIndex);
                        },
                        onHover: (e) => {
                            e.native.target.style.cursor = 'pointer';
                        },
                        onLeave: (e) => {
                            e.native.target.style.cursor = 'default';
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    createConcentracionChart(hallazgos, fragmentos) {
        // Store data for filtering
        this.concentracionData = { hallazgos, fragmentos };

        // Render with no filter initially (all folders)
        this.renderConcentracionChart('');
    }

    renderConcentracionChart(folderFilter) {
        const ctx = document.getElementById('chart-concentracion');
        if (!ctx || !this.concentracionData) return;

        const { hallazgos, fragmentos } = this.concentracionData;

        console.log('=== RENDERING CONCENTRATION CHART (BY FOLDER) ===');
        console.log('Filter:', folderFilter || 'ALL FOLDERS');
        console.log('Total hallazgos:', hallazgos.length);
        console.log('Total fragmentos:', fragmentos.length);

        // Count by FOLDER
        const byFolder = {};
        hallazgos.forEach(h => {
            const folder = h.folder || 'Sin carpeta';
            byFolder[folder] = (byFolder[folder] || 0) + 1;
        });
        fragmentos.forEach(f => {
            const folder = f.folder || 'Sin carpeta';
            byFolder[folder] = (byFolder[folder] || 0) + 1;
        });

        console.log('All folders count:', byFolder);

        // Filter if specific folder selected
        let foldersToShow = Object.entries(byFolder);
        if (folderFilter && folderFilter !== '') {
            foldersToShow = foldersToShow.filter(([folder, count]) => folder === folderFilter);
            console.log('Filtered to show only:', folderFilter);
        }

        // Sort by count
        const sorted = foldersToShow.sort((a, b) => b[1] - a[1]);

        const labels = sorted.map(e => e[0]);
        const data = sorted.map(e => e[1]);

        console.log('Chart labels (folders):', labels);
        console.log('Chart data (counts):', data);

        // Destroy previous chart
        if (this.chartConcentracion) {
            this.chartConcentracion.destroy();
        }

        // Multi-color palette
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];

        // Apply custom colors if they exist
        const backgroundColors = labels.map((label, idx) =>
            this.customChartColors?.concentracion?.[label] || colors[idx % colors.length]
        );

        this.chartConcentracion = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total (Hallazgos + Fragmentos)',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                // Click on bars to pick color
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const element = activeElements[0];
                        const index = element.index;
                        const label = labels[index];
                        this.openColorPicker('concentracion', label, index);
                    }
                },
                onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                },
                plugins: {
                    legend: {
                        display: false // Hide legend for this chart type
                    },
                    tooltip: {
                        callbacks: {
                            footer: () => 'Click para cambiar color'
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    populateConcentrationFolderFilter(hallazgos, fragmentos) {
        // Get unique folders
        const folders = new Set();
        hallazgos.forEach(h => { if (h.folder) folders.add(h.folder); });
        fragmentos.forEach(f => { if (f.folder) folders.add(f.folder); });
        const sortedFolders = Array.from(folders).sort();

        // Populate CONCENTRATION folder filter
        const selectConcentracion = document.getElementById('filter-concentration-folder');
        if (selectConcentracion) {
            // Remove old listener by cloning
            const newSelectConc = selectConcentracion.cloneNode(false);
            selectConcentracion.parentNode.replaceChild(newSelectConc, selectConcentracion);

            newSelectConc.innerHTML = '<option value="">Todas las carpetas</option>';
            sortedFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                newSelectConc.appendChild(option);
            });

            // Add change listener
            newSelectConc.addEventListener('change', (e) => {
                this.renderConcentracionChart(e.target.value);
            });
        }

        // Populate MATERIAL folder filter
        const selectMaterial = document.getElementById('filter-material-folder');
        if (selectMaterial) {
            // Remove old listener by cloning
            const newSelectMat = selectMaterial.cloneNode(false);
            selectMaterial.parentNode.replaceChild(newSelectMat, selectMaterial);

            newSelectMat.innerHTML = '<option value="">Todas las carpetas</option>';
            sortedFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                newSelectMat.appendChild(option);
            });

            // Add change listener
            newSelectMat.addEventListener('change', (e) => {
                this.renderTipoMaterialChart(e.target.value);
            });
        }

        // Populate FORMACIÓN GEOLÓGICA folder filter
        const selectFormacion = document.getElementById('filter-formacion-folder');
        if (selectFormacion) {
            const newSelectForm = selectFormacion.cloneNode(false);
            selectFormacion.parentNode.replaceChild(newSelectForm, selectFormacion);

            newSelectForm.innerHTML = '<option value="">Todas las carpetas</option>';
            sortedFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                newSelectForm.appendChild(option);
            });

            newSelectForm.addEventListener('change', (e) => {
                this.renderFormacionGeologicaChart(e.target.value);
            });
        }

        // Populate CLASIFICACIÓN TAXONÓMICA folder filter
        const selectTaxonomica = document.getElementById('filter-taxonomica-folder');
        if (selectTaxonomica) {
            const newSelectTax = selectTaxonomica.cloneNode(false);
            selectTaxonomica.parentNode.replaceChild(newSelectTax, selectTaxonomica);

            newSelectTax.innerHTML = '<option value="">Todas las carpetas</option>';
            sortedFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                newSelectTax.appendChild(option);
            });

            newSelectTax.addEventListener('change', (e) => {
                this.renderClasificacionTaxonomicaChart(e.target.value);
            });
        }

        // Populate ACCIÓN folder filter
        const selectAccion = document.getElementById('filter-accion-folder');
        if (selectAccion) {
            const newSelectAcc = selectAccion.cloneNode(false);
            selectAccion.parentNode.replaceChild(newSelectAcc, selectAccion);

            newSelectAcc.innerHTML = '<option value="">Todas las carpetas</option>';
            sortedFolders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                newSelectAcc.appendChild(option);
            });

            newSelectAcc.addEventListener('change', (e) => {
                this.renderAccionChart(e.target.value);
            });
        }
    }

    // DOWNLOAD AND CUSTOMIZATION FUNCTIONS

    downloadChartPNG(chartId, filename) {
        const canvas = document.getElementById(chartId);
        if (!canvas) {
            alert('Gráfico no encontrado');
            return;
        }

        try {
            // Get chart instance
            const chart = Chart.getChart(canvas);
            if (!chart) {
                alert('No se pudo obtener el gráfico');
                return;
            }

            // Convert to PNG
            const url = chart.toBase64Image();
            const link = document.createElement('a');
            link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = url;
            link.click();
        } catch (error) {
            console.error('Error downloading chart as PNG:', error);
            alert('Error al descargar la imagen');
        }
    }

    async downloadChartExcel(chartType) {
        try {
            let data, headers, rows, filename;

            switch (chartType) {
                case 'carpeta':
                    // Hallazgos por Carpeta
                    if (!this.chartPorCarpeta) {
                        alert('Gráfico no disponible');
                        return;
                    }
                    const carpetaData = this.chartPorCarpeta.data;
                    headers = ['Carpeta', 'Cantidad'];
                    rows = carpetaData.labels.map((label, i) => [label, carpetaData.datasets[0].data[i]]);
                    filename = 'hallazgos_por_carpeta';
                    break;

                case 'material':
                    // Tipos de Material
                    if (!this.chartTipoMaterial) {
                        alert('Gráfico no disponible');
                        return;
                    }
                    const materialData = this.chartTipoMaterial.data;
                    headers = ['Tipo Material', 'Cantidad'];
                    rows = materialData.labels.map((label, i) => [label, materialData.datasets[0].data[i]]);
                    filename = 'tipos_de_material';
                    break;

                case 'temporal':
                    // Tendencia Temporal
                    if (!this.chartTemporal) {
                        alert('Gráfico no disponible');
                        return;
                    }
                    const temporalData = this.chartTemporal.data;
                    headers = ['Mes', 'Cantidad'];
                    rows = temporalData.labels.map((label, i) => [label, temporalData.datasets[0].data[i]]);
                    filename = 'tendencia_temporal';
                    break;

                case 'concentracion':
                    // Concentración por Localidad
                    if (!this.chartConcentracion) {
                        alert('Gráfico no disponible');
                        return;
                    }
                    const concentracionData = this.chartConcentracion.data;
                    headers = ['Localidad', 'Total (Hallazgos + Fragmentos)'];
                    rows = concentracionData.labels.map((label, i) => [label, concentracionData.datasets[0].data[i]]);
                    filename = 'concentracion_localidad';
                    break;

                case 'formacion':
                    // Formación Geológica
                    if (!this.chartFormacion) {
                        alert('Gráfico no disponible');
                        return;
                    }
                    const formacionData = this.chartFormacion.data;
                    headers = ['Formación Geológica', 'Cantidad'];
                    rows = formacionData.labels.map((label, i) => [label, formacionData.datasets[0].data[i]]);
                    filename = 'formacion_geologica';
                    break;

                case 'taxonomica':
                    // Clasificación Taxonómica
                    if (!this.chartTaxonomica) {
                        alert('Gráfico no disponible');
                        return;
                    }
                    const taxonomicaData = this.chartTaxonomica.data;
                    headers = ['Clasificación Taxonómica', 'Cantidad'];
                    rows = taxonomicaData.labels.map((label, i) => [label, taxonomicaData.datasets[0].data[i]]);
                    filename = 'clasificacion_taxonomica';
                    break;

                case 'accion':
                    // Acción
                    if (!this.chartAccion) {
                        alert('Gráfico no disponible');
                        return;
                    }
                    const accionData = this.chartAccion.data;
                    headers = ['Acción', 'Cantidad'];
                    rows = accionData.labels.map((label, i) => [label, accionData.datasets[0].data[i]]);
                    filename = 'accion';
                    break;

                default:
                    alert('Tipo de gráfico no reconocido');
                    return;
            }

            // Create Excel file
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Datos');

            // Add headers
            worksheet.addRow(headers);
            worksheet.getRow(1).font = { bold: true };

            // Add data rows
            rows.forEach(row => {
                worksheet.addRow(row);
            });

            // Auto-fit columns
            worksheet.columns.forEach(column => {
                column.width = 20;
            });

            // Generate file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error downloading Excel:', error);
            alert('Error al descargar Excel');
        }
    }

    setupColorChangeListeners() {
        // Color for Hallazgos por Carpeta
        const colorCarpeta = document.getElementById('color-carpeta');
        if (colorCarpeta) {
            colorCarpeta.addEventListener('change', (e) => {
                if (this.chartPorCarpeta) {
                    this.chartPorCarpeta.data.datasets[0].backgroundColor = e.target.value;
                    this.chartPorCarpeta.data.datasets[0].borderColor = e.target.value;
                    this.chartPorCarpeta.update();
                }
            });
        }

        // Color for Tendencia Temporal
        const colorTemporal = document.getElementById('color-temporal');
        if (colorTemporal) {
            colorTemporal.addEventListener('change', (e) => {
                if (this.chartTemporal) {
                    this.chartTemporal.data.datasets[0].borderColor = e.target.value;
                    this.chartTemporal.data.datasets[0].pointBackgroundColor = e.target.value;
                    this.chartTemporal.data.datasets[0].backgroundColor = e.target.value + '1a'; // Add alpha
                    this.chartTemporal.update();
                }
            });
        }

        // Color for Concentración
        const colorConcentracion = document.getElementById('color-concentracion');
        if (colorConcentracion) {
            colorConcentracion.addEventListener('change', (e) => {
                if (this.chartConcentracion) {
                    this.chartConcentracion.data.datasets[0].backgroundColor = e.target.value;
                    this.chartConcentracion.data.datasets[0].borderColor = e.target.value;
                    this.chartConcentracion.update();
                }
            });
        }

        // Scale control for Temporal
        const scaleTemporal = document.getElementById('scale-temporal');
        if (scaleTemporal) {
            scaleTemporal.addEventListener('change', (e) => {
                if (this.chartTemporal) {
                    const isAuto = e.target.value === 'auto';
                    this.chartTemporal.options.scales.y.beginAtZero = isAuto;
                    this.chartTemporal.update();
                }
            });
        }
    }


}

// Initialize the admin panel
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel; // Expose globally for onclick handlers
