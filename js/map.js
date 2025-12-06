class MapManager {
    constructor(store) {
        this.store = store;
        this.map = null;
        this.markersLayer = null;
        this.routesLayer = null;
        this.filters = {
            showRoutes: true,
            showHallazgos: true,
            showAstillas: true,
            hallazgosFolder: 'all',
            astillasFolder: 'all'
        };
    }

    init(elementId) {
        // Initialize Leaflet
        this.map = L.map(elementId).setView([-43.3, -65.1], 5);

        // Esri World Imagery (Satellite)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(this.map);

        this.markersLayer = L.layerGroup().addTo(this.map);
        this.routesLayer = L.layerGroup().addTo(this.map);

        // Load initial data
        this.refreshMapData();
    }

    setFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
        this.refreshMapData();
    }

    refreshMapData() {
        if (!this.map) return;
        this.markersLayer.clearLayers();
        this.routesLayer.clearLayers();

        // Add Hallazgos
        if (this.filters.showHallazgos) {
            const hallazgos = this.store.getHallazgos();
            hallazgos.forEach(h => {
                // Filter by folder
                if (this.filters.hallazgosFolder !== 'all' && h.folder !== this.filters.hallazgosFolder) {
                    return;
                }

                if (h.lat && h.lng) {
                    L.marker([h.lat, h.lng], {
                        icon: L.divIcon({
                            className: 'custom-pin',
                            html: '📍',
                            iconSize: [24, 24],
                            iconAnchor: [12, 24]
                        })
                    })
                        .bindPopup(`<b>${h.codigo || 'Hallazgo'}</b><br>${h.tipo_material}<br>${h.folder || ''}`)
                        .addTo(this.markersLayer);
                }
            });
        }

        // Add Astillas
        if (this.filters.showAstillas) {
            const astillas = this.store.getAstillas();
            astillas.forEach(a => {
                // Filter by folder
                if (this.filters.astillasFolder !== 'all' && a.folder !== this.filters.astillasFolder) {
                    return;
                }

                if (a.lat && a.lng) {
                    L.marker([a.lat, a.lng], {
                        icon: L.divIcon({
                            className: 'custom-bone',
                            html: '🦴',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    })
                        .bindPopup(`<b>Astilla</b><br>${a.localidad}<br>${a.folder || ''}`)
                        .addTo(this.markersLayer);
                }
            });
        }

        // Re-add routes
        if (this.filters.showRoutes) {
            const routes = this.store.getRoutes();
            routes.forEach(r => {
                if (r.content) {
                    this.parseAndShowKML(r.content, false, r.color);
                }
            });
        }
    }

    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocation not supported');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                },
                { enableHighAccuracy: true }
            );
        });
    }

    // Improved KML Parser
    parseAndShowKML(fileContent, saveToStore = true, color = '#FF5722') {
        if (!this.map) return { success: false, message: "Map not initialized" };

        const parser = new DOMParser();
        const kml = parser.parseFromString(fileContent, 'text/xml');

        // Check for parsing errors
        const parseError = kml.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
            return { success: false, message: "Error al leer el archivo XML/KML." };
        }

        let bounds = L.latLngBounds([]);
        let foundCount = 0;

        // Helper to parse coordinate string "lon,lat,alt lon,lat,alt ..."
        const parseCoords = (str) => {
            return str.trim().split(/\s+/).map(pair => {
                const parts = pair.split(',');
                if (parts.length >= 2) {
                    // KML is usually Lon,Lat. Leaflet wants Lat,Lon.
                    const lat = parseFloat(parts[1]);
                    const lng = parseFloat(parts[0]);
                    if (isNaN(lat) || isNaN(lng)) return null;
                    return [lat, lng];
                }
                return null;
            }).filter(p => p !== null);
        };

        // Strategy 1: Standard LineString/Point search
        const processElements = (tagName, type) => {
            const elements = kml.getElementsByTagName(tagName);
            for (let i = 0; i < elements.length; i++) {
                const coordsNode = elements[i].getElementsByTagName('coordinates')[0];
                if (coordsNode) {
                    const points = parseCoords(coordsNode.textContent);
                    if (points.length > 0) {
                        if (type === 'line') {
                            const poly = L.polyline(points, { color: color, weight: 5 }).addTo(this.routesLayer);
                            bounds.extend(poly.getBounds());
                        } else if (type === 'point') {
                            // Only add points if they are part of the route file, maybe distinct style?
                            // For now, let's treat them as route markers
                            L.circleMarker(points[0], { radius: 5, color: 'blue' }).addTo(this.routesLayer);
                            bounds.extend(L.latLngBounds(points));
                        }
                        foundCount++;
                    }
                }
            }
        };

        processElements('LineString', 'line');
        processElements('Point', 'point');

        // Strategy 2: Universal Fallback (if nothing found yet)
        // Search for ANY <coordinates> tag if we haven't found standard geometries
        if (foundCount === 0) {
            const allCoords = kml.getElementsByTagName('coordinates');
            for (let i = 0; i < allCoords.length; i++) {
                const points = parseCoords(allCoords[i].textContent);
                if (points.length > 1) {
                    // Assume path
                    const poly = L.polyline(points, { color: color, weight: 5 }).addTo(this.routesLayer);
                    bounds.extend(poly.getBounds());
                    foundCount++;
                } else if (points.length === 1) {
                    // Assume point
                    L.circleMarker(points[0], { radius: 5, color: 'blue' }).addTo(this.routesLayer);
                    bounds.extend(L.latLngBounds(points));
                    foundCount++;
                }
            }
        }

        if (foundCount > 0) {
            this.map.fitBounds(bounds);
            return { success: true, message: `Se cargaron ${foundCount} elementos.` };
        } else {
            return { success: false, message: "No se encontraron coordenadas válidas (LineString o Point) en el archivo." };
        }
    }
}
