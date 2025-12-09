// window.onerror removed to use the one in index.html

// alert("App JS Loaded!"); // Immediate check

document.addEventListener('DOMContentLoaded', () => {
    const store = new Store();
    const ui = new UI(store);
    const mapManager = new MapManager(store);

    ui.init();

    // --- Map Filters & Persistence ---
    const defaultFilters = {
        showRoutes: true,
        showHallazgos: true,
        showAstillas: true,
        hallazgosFolder: 'all',
        astillasFolder: 'all'
    };

    const savedFilters = JSON.parse(localStorage.getItem('mapFilters')) || defaultFilters;
    mapManager.setFilters(savedFilters);

    mapManager.init('map-container');

    // Initialize Filter UI Controls
    const filterRoutes = document.getElementById('filter-routes');
    const filterHallazgos = document.getElementById('filter-hallazgos');
    const filterAstillas = document.getElementById('filter-astillas');
    const filterHallazgosFolder = document.getElementById('filter-hallazgos-folder');
    const filterAstillasFolder = document.getElementById('filter-astillas-folder');
    const toggleFiltersBtn = document.getElementById('toggle-filters');
    const filtersContent = document.getElementById('map-filters-content');

    // Set initial UI state
    if (filterRoutes) filterRoutes.checked = savedFilters.showRoutes;
    if (filterHallazgos) filterHallazgos.checked = savedFilters.showHallazgos;
    if (filterAstillas) filterAstillas.checked = savedFilters.showAstillas;

    // Populate Folder Dropdowns
    const populateFolderSelect = (select, items, selectedFolder) => {
        if (!select) return;
        const folders = new Set();
        items.forEach(item => {
            if (item.folder) folders.add(item.folder);
        });

        // Keep "all" option
        select.innerHTML = '<option value="all">Todas las carpetas</option>';

        Array.from(folders).sort().forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            if (folder === selectedFolder) option.selected = true;
            select.appendChild(option);
        });
    };

    populateFolderSelect(filterHallazgosFolder, store.getHallazgos(), savedFilters.hallazgosFolder);
    populateFolderSelect(filterAstillasFolder, store.getAstillas(), savedFilters.astillasFolder);

    // Filter Change Handler
    const handleFilterChange = () => {
        const newFilters = {
            showRoutes: filterRoutes ? filterRoutes.checked : true,
            showHallazgos: filterHallazgos ? filterHallazgos.checked : true,
            showAstillas: filterAstillas ? filterAstillas.checked : true,
            hallazgosFolder: filterHallazgosFolder ? filterHallazgosFolder.value : 'all',
            astillasFolder: filterAstillasFolder ? filterAstillasFolder.value : 'all'
        };

        mapManager.setFilters(newFilters);
        localStorage.setItem('mapFilters', JSON.stringify(newFilters));
    };

    // Add Listeners
    if (filterRoutes) filterRoutes.addEventListener('change', handleFilterChange);
    if (filterHallazgos) filterHallazgos.addEventListener('change', handleFilterChange);
    if (filterAstillas) filterAstillas.addEventListener('change', handleFilterChange);
    if (filterHallazgosFolder) filterHallazgosFolder.addEventListener('change', handleFilterChange);
    if (filterAstillasFolder) filterAstillasFolder.addEventListener('change', handleFilterChange);

    // Toggle Panel
    if (toggleFiltersBtn && filtersContent) {
        toggleFiltersBtn.addEventListener('click', () => {
            filtersContent.classList.toggle('collapsed');
            toggleFiltersBtn.textContent = filtersContent.classList.contains('collapsed') ? '▶' : '▼';
        });
    }

    // --- Tracking ---
    const btnToggleTracking = document.getElementById('btn-toggle-tracking');
    const pathInfoDiv = document.getElementById('path-info');
    const pathPointsCount = document.getElementById('path-points-count');
    const pathDistance = document.getElementById('path-distance');
    const chkRecordPath = document.getElementById('chk-record-path');

    // Update path info periodically when recording
    let pathInfoInterval = null;

    const updatePathInfo = () => {
        if (!mapManager.isRecordingPath) return;
        const info = mapManager.getPathInfo();
        if (pathPointsCount) pathPointsCount.textContent = info.points;
        if (pathDistance) {
            if (info.distance >= 1000) {
                pathDistance.textContent = (info.distance / 1000).toFixed(2) + ' km';
            } else {
                pathDistance.textContent = info.distance + ' m';
            }
        }
    };

    if (btnToggleTracking) {
        btnToggleTracking.addEventListener('click', () => {
            const isTracking = btnToggleTracking.classList.toggle('tracking-active');

            if (isTracking) {
                // Starting tracking - clear any old path from previous session
                mapManager.clearPath();
                if (chkRecordPath) chkRecordPath.checked = false;
                if (pathInfoDiv) pathInfoDiv.style.display = 'none';

                btnToggleTracking.innerHTML = '<span>◉</span> Detener Seguimiento';
                mapManager.toggleTracking(true);
            } else {
                // Stopping tracking - keep path visible so user can save it
                btnToggleTracking.innerHTML = '<span>◎</span> Iniciar Seguimiento';
                mapManager.toggleTracking(false);

                // Stop recording but keep the path visible
                mapManager.setRecordingPath(false);
                if (chkRecordPath) chkRecordPath.checked = false;

                // Stop updating path info but keep it visible if there's a path
                if (pathInfoInterval) {
                    clearInterval(pathInfoInterval);
                    pathInfoInterval = null;
                }

                // Update path info one last time and keep visible if there are points
                const info = mapManager.getPathInfo();
                if (info.points > 0) {
                    updatePathInfo();
                    if (pathInfoDiv) pathInfoDiv.style.display = 'block';
                } else {
                    if (pathInfoDiv) pathInfoDiv.style.display = 'none';
                }
            }
        });
    }

    if (chkRecordPath) {
        chkRecordPath.addEventListener('change', (e) => {
            mapManager.setRecordingPath(e.target.checked);

            if (e.target.checked) {
                // Show path info and start updating
                if (pathInfoDiv) pathInfoDiv.style.display = 'block';
                updatePathInfo();
                pathInfoInterval = setInterval(updatePathInfo, 2000); // Update every 2 seconds
            } else {
                // Stop updating but keep path info visible if there are points to save
                if (pathInfoInterval) {
                    clearInterval(pathInfoInterval);
                    pathInfoInterval = null;
                }

                // Check if there's a path to save
                const info = mapManager.getPathInfo();
                if (info.points > 0) {
                    updatePathInfo(); // Update one last time
                    if (pathInfoDiv) pathInfoDiv.style.display = 'block';
                } else {
                    if (pathInfoDiv) pathInfoDiv.style.display = 'none';
                }
            }
        });
    }

    // Save Path Button
    const btnSavePath = document.getElementById('btn-save-path');
    if (btnSavePath) {
        btnSavePath.addEventListener('click', () => {
            const result = mapManager.saveCurrentPath();

            if (result.success) {
                // Save to store
                store.addRoute({ name: result.name, content: result.kml });

                // Clear the current path
                mapManager.clearPath();
                if (chkRecordPath) chkRecordPath.checked = false;
                if (pathInfoDiv) pathInfoDiv.style.display = 'none';

                // Stop updating
                if (pathInfoInterval) {
                    clearInterval(pathInfoInterval);
                    pathInfoInterval = null;
                }

                // Refresh map to show the saved route
                mapManager.refreshMapData();
                ui.renderRoutesList();

                alert('✅ Recorrido guardado exitosamente: ' + result.name);
            } else {
                alert('❌ ' + result.message);
            }
        });
    }


    // --- Navigation ---
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Handle click on the button or its children (icon/span)
            const targetBtn = e.target.closest('.nav-item');
            if (!targetBtn) return;

            // Debug click
            // alert('Nav clicked: ' + targetBtn.dataset.target);

            const targetId = targetBtn.dataset.target;
            ui.switchTab(targetId);

            if (targetId === 'tab-caminos') {
                setTimeout(() => {
                    if (mapManager.map) {
                        mapManager.map.invalidateSize();
                        // Refresh to ensure filters are applied if data changed
                        // Also update folder lists in case new data was added
                        populateFolderSelect(filterHallazgosFolder, store.getHallazgos(), mapManager.filters.hallazgosFolder);
                        populateFolderSelect(filterAstillasFolder, store.getAstillas(), mapManager.filters.astillasFolder);
                        mapManager.refreshMapData();
                    }
                }, 100);
            }
        });
    });

    // --- Modals ---
    const openHallazgoBtn = document.getElementById('btn-new-hallazgo');
    if (openHallazgoBtn) {
        openHallazgoBtn.addEventListener('click', () => {
            ui.toggleModal('hallazgos-form-container', true);
            // Auto-capture removed in favor of manual button, or optional
            // captureLocation('hallazgo-gps-status', 'form-hallazgo'); 
        });
    }

    const closeHallazgoBtn = document.getElementById('btn-close-hallazgo');
    if (closeHallazgoBtn) {
        closeHallazgoBtn.addEventListener('click', () => ui.toggleModal('hallazgos-form-container', false));
    }

    const openAstillaBtn = document.getElementById('btn-new-astilla');
    if (openAstillaBtn) {
        openAstillaBtn.addEventListener('click', () => {
            ui.toggleModal('astillas-form-container', true);
            // captureLocation('astilla-gps-status', 'form-astilla');
        });
    }

    const closeAstillaBtn = document.getElementById('btn-close-astilla');
    if (closeAstillaBtn) {
        closeAstillaBtn.addEventListener('click', () => ui.toggleModal('astillas-form-container', false));
    }

    // Detail Modal
    const closeDetailBtn = document.getElementById('btn-close-detail');
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => ui.toggleModal('detail-modal', false));
    }

    const deleteBtn = document.getElementById('btn-delete-item');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => ui.deleteItem());
    }

    const editBtn = document.getElementById('btn-edit-item');
    if (editBtn) {
        editBtn.addEventListener('click', () => ui.editItem());
    }

    // --- GPS Buttons ---
    const btnCaptureHallazgo = document.getElementById('btn-capture-hallazgo');
    if (btnCaptureHallazgo) {
        btnCaptureHallazgo.addEventListener('click', () => captureLocation('hallazgo-gps-status', 'form-hallazgo'));
    }

    const btnCaptureAstilla = document.getElementById('btn-capture-astilla');
    if (btnCaptureAstilla) {
        btnCaptureAstilla.addEventListener('click', () => captureLocation('astilla-gps-status', 'form-astilla'));
    }

    // --- Forms ---
    // Hallazgo Submit
    const formHallazgo = document.getElementById('form-hallazgo');
    if (formHallazgo) {
        formHallazgo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // Handle image as DataURL
            const fileInput = document.getElementById('hallazgo-foto');
            if (fileInput && fileInput.files[0]) {
                data.foto = await toBase64(fileInput.files[0]);
            }

            // Check if we're editing
            const editingId = e.target.dataset.editingId;
            if (editingId) {
                store.updateHallazgo(editingId, data);
                delete e.target.dataset.editingId;
            } else {
                store.addHallazgo(data);
            }

            ui.renderHallazgos();
            ui.updateFolderLists();
            ui.toggleModal('hallazgos-form-container', false);
            e.target.reset();
            const preview = document.getElementById('hallazgo-foto-preview');
            if (preview) preview.innerHTML = '';
            // Clear GPS status
            document.getElementById('hallazgo-gps-status').textContent = '';
        });
    }

    // Astilla Submit
    const formAstilla = document.getElementById('form-astilla');
    if (formAstilla) {
        formAstilla.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            const fileInput = document.getElementById('astilla-foto');
            if (fileInput && fileInput.files[0]) {
                data.foto = await toBase64(fileInput.files[0]);
            }

            // Check if we're editing
            const editingId = e.target.dataset.editingId;
            if (editingId) {
                store.updateAstilla(editingId, data);
                delete e.target.dataset.editingId;
            } else {
                store.addAstilla(data);
            }

            ui.renderAstillas();
            ui.updateFolderLists();
            ui.toggleModal('astillas-form-container', false);
            e.target.reset();
            const preview = document.getElementById('astilla-foto-preview');
            if (preview) preview.innerHTML = '';
            // Clear GPS status
            document.getElementById('astilla-gps-status').textContent = '';
        });
    }

    // --- Image Previews ---
    const hallazgoFotoInput = document.getElementById('hallazgo-foto');
    if (hallazgoFotoInput) {
        hallazgoFotoInput.addEventListener('change', (e) => ui.handleImagePreview(e.target, 'hallazgo-foto-preview'));
    }

    const astillaFotoInput = document.getElementById('astilla-foto');
    if (astillaFotoInput) {
        astillaFotoInput.addEventListener('change', (e) => ui.handleImagePreview(e.target, 'astilla-foto-preview'));
    }

    // --- GPS Helper ---
    function captureLocation(statusId, formId) {
        const statusEl = document.getElementById(statusId);
        const form = document.getElementById(formId);
        if (!statusEl || !form) return;

        statusEl.textContent = 'Buscando satélites...';
        statusEl.style.color = 'orange';

        mapManager.getCurrentLocation()
            .then(coords => {
                statusEl.textContent = 'Ubicación capturada';
                statusEl.style.color = 'var(--success)';

                const latInput = form.querySelector('[name="lat"]');
                const lngInput = form.querySelector('[name="lng"]');

                if (latInput) latInput.value = coords.lat.toFixed(6);
                if (lngInput) lngInput.value = coords.lng.toFixed(6);
            })
            .catch(err => {
                statusEl.textContent = 'Error GPS: ' + err.message;
                statusEl.style.color = 'red';
            });
    }

    // --- KML Upload ---
    const kmlUpload = document.getElementById('kml-upload');
    if (kmlUpload) {
        kmlUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const result = mapManager.parseAndShowKML(content, true);

                if (result.success) {
                    store.addRoute({ name: file.name, content: content });
                    alert(`Éxito: ${result.message}`);
                } else {
                    alert(`Error: ${result.message}\nAsegúrate de que sea un archivo KML válido (no KMZ comprimido).`);
                }
            };
            reader.readAsText(file);
        });
    }

    // --- Utils ---
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });


    // --- Role Selector ---
    const updateRoleUI = (role) => {
        const exportBtn = document.getElementById('btn-export');
        const backupBtn = document.getElementById('btn-backup');
        const restoreBtn = document.getElementById('btn-restore');

        if (role === 'admin') {
            if (exportBtn) exportBtn.style.display = 'inline-block';
            if (restoreBtn) restoreBtn.style.display = 'inline-block';
            if (backupBtn) {
                backupBtn.style.display = 'inline-block';
                backupBtn.textContent = '💾 Backup';
            }
        } else {
            // Collector Mode
            if (exportBtn) exportBtn.style.display = 'none';
            if (restoreBtn) restoreBtn.style.display = 'none';

            // Allow collector to "Send Data" (same as backup)
            if (backupBtn) {
                backupBtn.style.display = 'inline-block';
                backupBtn.textContent = '📤 Enviar Datos';
            }
        }
    };

    const roleSelector = document.getElementById('role-selector');
    if (roleSelector) {
        roleSelector.addEventListener('change', (e) => {
            const selectedRole = e.target.value;

            if (selectedRole === 'admin') {
                const password = prompt("Ingrese la contraseña de administrador:");
                if (password === 'admin123') {
                    updateRoleUI('admin');
                } else {
                    alert("Contraseña incorrecta.");
                    roleSelector.value = 'collector';
                    updateRoleUI('collector');
                }
            } else {
                updateRoleUI('collector');
            }
        });
    }

    // Init role UI
    updateRoleUI('collector'); // Default to collector for security
    if (roleSelector) roleSelector.value = 'collector';

    // --- Export ---
    // --- Export ---
    const exportBtn = document.getElementById('btn-export');
    const exportModal = document.getElementById('export-modal');
    const closeExportBtn = document.getElementById('btn-close-export');
    const confirmExportBtn = document.getElementById('btn-confirm-export');
    const exportSelectAll = document.getElementById('export-select-all');
    const exportFolderList = document.getElementById('export-folder-list');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            renderExportOptions();
            ui.toggleModal('export-modal', true);
        });
    }

    if (closeExportBtn) {
        closeExportBtn.addEventListener('click', () => ui.toggleModal('export-modal', false));
    }

    if (exportSelectAll) {
        exportSelectAll.addEventListener('change', (e) => {
            const checkboxes = exportFolderList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
    }

    function renderExportOptions() {
        if (!exportFolderList) return;
        exportFolderList.innerHTML = '';

        const folders = store.getFolders();
        // Always include "Sin Carpeta" option if there are items without folder
        // But store.getFolders() might not return null/empty string. 
        // Let's check data directly or just trust getFolders + explicit check.

        // Add "Sin Carpeta" explicitly if needed, or handle empty strings in getFolders
        // For now, let's iterate what getFolders gives us.

        if (folders.length === 0) {
            exportFolderList.innerHTML = '<div class="empty-state">No hay carpetas para exportar.</div>';
            return;
        }

        folders.forEach(folder => {
            const label = document.createElement('label');
            const folderName = folder || 'Sin Carpeta';
            label.innerHTML = `
                <input type="checkbox" value="${folder}" checked>
                ${folderName}
            `;
            exportFolderList.appendChild(label);
        });
    }

    if (confirmExportBtn) {
        confirmExportBtn.addEventListener('click', () => {
            const selectedFolders = Array.from(exportFolderList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => cb.value);

            if (selectedFolders.length === 0) {
                alert('Por favor selecciona al menos una carpeta.');
                return;
            }

            const allData = store.getAllDataForExport();

            // Filter data based on selected folders
            const filteredData = {
                hallazgos: allData.hallazgos.filter(h => selectedFolders.includes(h.folder || '')), // Handle null/undefined folder as empty string match if that's how it's stored, or check logic
                astillas: allData.astillas.filter(a => selectedFolders.includes(a.folder || '')),
                routes: allData.routes // Routes don't have folders yet, export all or add logic? For now export all routes.
            };

            // Fix for "Sin Carpeta" logic: if "Sin Carpeta" is selected, we might need to match null/undefined/empty string
            // In renderExportOptions we used folder value directly. If folder was null/undefined/empty, we need to ensure value is consistent.
            // Let's assume store.getFolders() returns empty string for no folder.

            const kml = Exporter.generateKML(filteredData);
            const filename = `paleo_export_${new Date().toISOString().slice(0, 10)}.kml`;
            Exporter.download(filename, kml);

            ui.toggleModal('export-modal', false);
        });
    }

    // --- Backup & Restore (JSON) ---
    const btnBackup = document.getElementById('btn-backup');
    const btnRestore = document.getElementById('btn-restore');
    const restoreInput = document.getElementById('restore-file-input');

    if (btnBackup) {
        btnBackup.addEventListener('click', () => {
            const data = store.getAllDataForExport();
            const jsonString = JSON.stringify(data, null, 2);
            const filename = `paleo_backup_${new Date().toISOString().slice(0, 10)}.json`;

            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonString));
            element.setAttribute('download', filename);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        });
    }

    if (btnRestore) {
        btnRestore.addEventListener('click', () => {
            if (confirm("Esto importará datos de otro dispositivo. No se borrará nada, solo se agregarán datos nuevos. ¿Continuar?")) {
                restoreInput.click();
            }
        });
    }

    if (restoreInput) {
        restoreInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    const result = store.importData(jsonData);

                    alert(`Importación completada:\n- Agregados: ${result.added}\n- Omitidos (ya existían): ${result.skipped}`);

                    // Refresh UI
                    ui.renderHallazgos();
                    ui.renderAstillas();
                    ui.renderRoutesList();
                    ui.updateFolderLists();
                    mapManager.refreshMapData();

                } catch (err) {
                    alert("Error al leer el archivo de respaldo. Asegúrate de que sea un JSON válido.");
                    console.error(err);
                }
            };
            reader.readAsText(file);
            // Reset input so same file can be selected again if needed
            e.target.value = '';
        });
    }

    // --- Events ---
    document.addEventListener('route-updated', () => {
        if (mapManager) {
            mapManager.refreshMapData();
        }
    });

    // --- PWA Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js', { scope: '/Paleo-tracker/' })
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});
