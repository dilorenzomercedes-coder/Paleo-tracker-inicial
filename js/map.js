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
        // Tracking State
        this.watchId = null;
        this.isTracking = false;
        this.isRecordingPath = false;
        this.userMarker = null;
        this.userPath = null;
        this.pathCoords = [];
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
    // --- Real-time Location Tracking ---

    toggleTracking(enable, onUpdate) {
        if (enable) {
            if (this.isTracking) return; // Already tracking

            if (!navigator.geolocation) {
                alert("Geolocalización no soportada en este navegador.");
                return;
            }

            this.isTracking = true;
            this.pathCoords = []; // Reset path on new start? Or keep? Let's reset for this session.

            // Create marker and path if not exist
            if (!this.userMarker) {
                this.userMarker = L.circleMarker([0, 0], {
                    radius: 8,
                    fillColor: '#2196F3',
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(this.map);
                this.userMarker.bindPopup("Estás aquí");
            }

            if (!this.userPath) {
                this.userPath = L.polyline([], { color: '#2196F3', weight: 4, dashArray: '5, 10' }).addTo(this.map);
            } else {
                this.userPath.setLatLngs([]);
            }

            this.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    this.updateUserLocation(lat, lng);
                    if (onUpdate) onUpdate({ lat, lng });
                },
                (error) => {
                    console.error("Error watching position:", error);
                    alert("Error al obtener ubicación: " + error.message);
                    this.toggleTracking(false); // Stop on error
                },
                { enableHighAccuracy: true, maximumAge: 10000 }
            );

        } else {
            // Stop tracking
            this.isTracking = false;
            if (this.watchId !== null) {
                navigator.geolocation.clearWatch(this.watchId);
                this.watchId = null;
            }
            // Optional: Remove marker/path when stopping? 
            // Or keep them to show where you walked? Let's keep them.
        }
    }

    setRecordingPath(enabled) {
        this.isRecordingPath = enabled;
        if (enabled && this.isTracking && this.pathCoords.length === 0 && this.userMarker) {
            // If starting to record while already tracking, add current point start
            const latLng = this.userMarker.getLatLng();
            this.pathCoords.push(latLng);
        }
    }

    updateUserLocation(lat, lng) {
        if (!this.map) return;
        const latLng = [lat, lng];

        // Update Marker
        if (this.userMarker) {
            this.userMarker.setLatLng(latLng);
            if (!this.map.getBounds().contains(latLng)) {
                this.map.panTo(latLng);
            }
        }

        // Update Path - Only if recording
        if (this.isRecordingPath) {
            this.pathCoords.push(latLng);
            if (this.userPath) {
                this.userPath.setLatLngs(this.pathCoords);
            }
        }
    }

    getPathInfo() {
        if (!this.pathCoords || this.pathCoords.length === 0) {
            return { points: 0, distance: 0 };
        }

        // Calculate total distance
        let totalDistance = 0;
        for (let i = 1; i < this.pathCoords.length; i++) {
            const from = L.latLng(this.pathCoords[i - 1]);
            const to = L.latLng(this.pathCoords[i]);
            totalDistance += from.distanceTo(to);
        }

        return {
            points: this.pathCoords.length,
            distance: Math.round(totalDistance) // in meters
        };
    }

    saveCurrentPath() {
        if (!this.pathCoords || this.pathCoords.length < 2) {
            return { success: false, message: "No hay suficientes puntos para guardar (mínimo 2)" };
        }

        // Generate KML from current path
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const name = `Recorrido_${timestamp}`;

        // Build KML
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <Placemark>
      <name>${name}</name>
      <LineString>
        <coordinates>`;

        this.pathCoords.forEach(coord => {
            // KML format is lon,lat,alt
            kml += `\n          ${coord[1]},${coord[0]},0`;
        });

        kml += `
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

        return { success: true, kml: kml, name: name };
    }

    clearPath() {
        this.pathCoords = [];
        if (this.userPath) {
            this.userPath.setLatLngs([]);
        }
        this.isRecordingPath = false;
    }
}
