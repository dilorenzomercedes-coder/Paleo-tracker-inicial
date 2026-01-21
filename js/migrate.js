// Route Migration Tool - Integrated into Repair Button
// This script adds route migration functionality to the app

(function () {
    const originalRepairButton = document.getElementById('btn-repair');
    if (!originalRepairButton) return;

    // Replace the repair button click handler
    const newButton = originalRepairButton.cloneNode(true);
    originalRepairButton.parentNode.replaceChild(newButton, originalRepairButton);

    newButton.addEventListener('click', async () => {
        const choice = prompt(
            '¿Qué deseas hacer?\n\n' +
            '1. Reparar App (limpiar caché)\n' +
            '2. Recuperar Recorridos Antiguos\n' +
            '3. Cancelar\n\n' +
            'Escribe el número (1, 2 o 3):'
        );

        if (choice === '1') {
            await repairApp();
        } else if (choice === '2') {
            migrateOldRoutes();
        }
    });

    async function repairApp() {
        if (window.location.protocol === 'file:') {
            if (!confirm('Estás ejecutando la app como archivo local. La reparación solo recargará la página. ¿Continuar?')) return;
            window.location.reload();
            return;
        }

        if (!confirm('¿Reparar la aplicación? Esto actualizará la versión y recargará la página. No se borrarán tus datos.')) return;

        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    await reg.unregister();
                }
            }

            if ('caches' in window) {
                const keys = await caches.keys();
                for (const key of keys) {
                    await caches.delete(key);
                }
            }

            alert('Reparación completa. La página se recargará.');
            window.location.reload(true);
        } catch (e) {
            console.error(e);
            alert('Intentando recarga forzada...');
            window.location.reload(true);
        }
    }

    function migrateOldRoutes() {
        alert('🔍 Buscando recorridos antiguos...');

        const possibleKeys = [
            'paleo_paths',
            'paleo_recorridos',
            'paleo_tracks',
            'savedPaths',
            'recordedPaths',
            'paleoTrackingState'
        ];

        let foundOldRoutes = [];
        let foundKeys = [];

        possibleKeys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                foundKeys.push(key);
                try {
                    const parsed = JSON.parse(data);
                    foundOldRoutes.push({ key, data: parsed });
                } catch (e) {
                    foundOldRoutes.push({ key, data: data });
                }
            }
        });

        if (foundOldRoutes.length === 0) {
            alert('❌ No se encontraron recorridos antiguos.\n\nSi grabaste un recorrido con una versión anterior, es posible que se haya perdido.');
            return;
        }

        if (!confirm(`✅ Se encontraron ${foundOldRoutes.length} ubicación(es) con datos antiguos:\n\n${foundKeys.join('\n')}\n\n¿Deseas migrarlos?`)) return;

        let currentRoutes = [];
        try {
            const existing = localStorage.getItem('paleo_routes');
            if (existing) {
                currentRoutes = JSON.parse(existing);
            }
        } catch (e) {
            console.error('Error loading current routes:', e);
        }

        let migratedCount = 0;

        foundOldRoutes.forEach(item => {
            if (item.key === 'paleoTrackingState') {
                if (item.data.pathCoords && item.data.pathCoords.length > 0) {
                    const route = createRouteFromCoords(item.data.pathCoords, 'Recorrido Recuperado');
                    currentRoutes.push(route);
                    migratedCount++;
                }
            } else if (Array.isArray(item.data)) {
                item.data.forEach(route => {
                    if (route.content || route.kml) {
                        const newRoute = {
                            id: route.id || generateId(),
                            name: route.name || 'Recorrido Migrado',
                            content: route.content || route.kml,
                            timestamp: route.timestamp || new Date().toISOString(),
                            color: route.color || '#FF5722'
                        };
                        currentRoutes.push(newRoute);
                        migratedCount++;
                    }
                });
            } else if (typeof item.data === 'object') {
                if (item.data.content || item.data.kml) {
                    const newRoute = {
                        id: item.data.id || generateId(),
                        name: item.data.name || 'Recorrido Migrado',
                        content: item.data.content || item.data.kml,
                        timestamp: item.data.timestamp || new Date().toISOString(),
                        color: item.data.color || '#FF5722'
                    };
                    currentRoutes.push(newRoute);
                    migratedCount++;
                }
            }
        });

        if (migratedCount > 0) {
            try {
                localStorage.setItem('paleo_routes', JSON.stringify(currentRoutes));
                alert(`🎉 Migración completada!\n\n${migratedCount} recorrido(s) migrado(s)\nTotal de rutas ahora: ${currentRoutes.length}\n\nLa app se recargará para mostrar los cambios.`);
                window.location.reload();
            } catch (e) {
                alert(`❌ Error al guardar: ${e.message}`);
            }
        } else {
            alert('⚠️ No se encontraron recorridos válidos para migrar.');
        }
    }

    function createRouteFromCoords(coords, name) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const routeName = `${name}_${timestamp}`;

        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${routeName}</name>
    <description>Recorrido recuperado (${coords.length} puntos)</description>
    <Style id="trackStyle">
      <LineStyle>
        <color>ff00E676</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${routeName}</name>
      <styleUrl>#trackStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>`;

        coords.forEach(coord => {
            const lat = Array.isArray(coord) ? coord[0] : coord.lat;
            const lng = Array.isArray(coord) ? coord[1] : coord.lng;
            kml += `\n          ${lng},${lat},0`;
        });

        kml += `
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

        return {
            id: generateId(),
            name: routeName,
            content: kml,
            timestamp: new Date().toISOString(),
            color: '#FF5722'
        };
    }

    function generateId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
})();
