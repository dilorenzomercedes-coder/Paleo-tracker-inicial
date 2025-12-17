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
        // Enhanced tracking
        this.accuracyCircle = null;
        this.lastPosition = null;
        this.trackingStats = {
            accuracy: null,
            speed: null,
            heading: null,
            lastUpdate: null
        };
        // Minimum movement threshold in meters to add a new point
        this.MIN_MOVEMENT_THRESHOLD = 3;
        // Maximum acceptable accuracy in meters
        this.MAX_ACCURACY_THRESHOLD = 50;

        // Background tracking support
        this.wakeLock = null;
        this.saveInterval = null;
        this.backgroundSaveIntervalMs = 5000; // Save every 5 seconds when in background

        // Timestamp tracking for gap detection
        this.lastGPSTimestamp = null;
        this.wentToBackgroundAt = null;

        // Setup visibility change listener for background handling
        this.setupVisibilityHandler();
    }

    // Handle app going to background/foreground
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (this.isTracking || this.isRecordingPath) {
                if (document.hidden) {
                    // App went to background - save immediately and start frequent saves
                    console.log('App in background - enabling aggressive save');
                    this.wentToBackgroundAt = Date.now();
                    this.saveTrackingState();
                    this.startBackgroundSave();

                    // Re-request wake lock (Android may release it)
                    this.requestWakeLock();
                } else {
                    // App came back to foreground
                    console.log('App in foreground - checking for gap');
                    this.stopBackgroundSave();

                    // Check if there was a significant gap (GPS stopped in background)
                    if (this.wentToBackgroundAt && this.isRecordingPath) {
                        const gapSeconds = Math.round((Date.now() - this.wentToBackgroundAt) / 1000);
                        if (gapSeconds > 5) {
                            // Emit event for UI to show gap notification
                            const event = new CustomEvent('tracking-gap-detected', {
                                detail: {
                                    gapSeconds: gapSeconds,
                                    pointsRecorded: this.pathCoords.length
                                }
                            });
                            document.dispatchEvent(event);
                        }
                    }
                    this.wentToBackgroundAt = null;

                    // Force save current state
                    this.saveTrackingState();

                    // Re-request wake lock
                    this.requestWakeLock();
                }
            }
        });

        // Handle page unload - save everything before closing
        window.addEventListener('beforeunload', () => {
            if (this.isRecordingPath && this.pathCoords.length > 0) {
                this.saveTrackingState();
            }
        });

        // Handle page freeze (mobile browsers)
        document.addEventListener('freeze', () => {
            if (this.isRecordingPath && this.pathCoords.length > 0) {
                this.saveTrackingState();
            }
        });

        // Handle resume from freeze
        document.addEventListener('resume', () => {
            if (this.isTracking) {
                console.log('App resumed from freeze');
                this.requestWakeLock();
            }
        });
    }

    // Start aggressive background saving
    startBackgroundSave() {
        if (this.saveInterval) return;
        this.saveInterval = setInterval(() => {
            if (this.isRecordingPath && this.pathCoords.length > 0) {
                this.saveTrackingState();
            }
        }, this.backgroundSaveIntervalMs);
    }

    // Stop aggressive background saving
    stopBackgroundSave() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    }

    // Request Wake Lock to keep device awake
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock acquired');

                // Re-acquire wake lock if released (e.g., when tab becomes visible again)
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released');
                    // Try to re-acquire if still tracking
                    if (this.isTracking) {
                        this.requestWakeLock();
                    }
                });

                return true;
            } catch (err) {
                console.log('Wake Lock failed:', err.message);
                return false;
            }
        }
        return false;
    }

    // Release Wake Lock
    async releaseWakeLock() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
                console.log('Wake Lock released manually');
            } catch (err) {
                console.log('Error releasing Wake Lock:', err);
            }
        }
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

        // Restore tracking state if it was active
        this.restoreTrackingState();
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
                    // Build popup content with photo
                    let popupContent = `<div class="marker-popup">`;
                    popupContent += `<b>${h.codigo || 'Hallazgo'}</b><br>`;
                    popupContent += `<span class="popup-detail">${h.tipo_material || ''}</span>`;
                    if (h.folder) popupContent += `<br><span class="popup-folder">📁 ${h.folder}</span>`;
                    if (h.localidad) popupContent += `<br><span class="popup-location">📍 ${h.localidad}</span>`;

                    // Add photo if exists
                    if (h.foto1) {
                        popupContent += `<div class="popup-photo"><img src="${h.foto1}" alt="Foto del hallazgo"></div>`;
                    }
                    popupContent += `</div>`;

                    L.marker([h.lat, h.lng], {
                        icon: L.divIcon({
                            className: 'custom-pin',
                            html: '📍',
                            iconSize: [24, 24],
                            iconAnchor: [12, 24]
                        })
                    })
                        .bindPopup(popupContent, { maxWidth: 200 })
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
                    // Build popup content with photo
                    let popupContent = `<div class="marker-popup">`;
                    popupContent += `<b>🦴 Astilla</b><br>`;
                    if (a.localidad) popupContent += `<span class="popup-location">📍 ${a.localidad}</span>`;
                    if (a.folder) popupContent += `<br><span class="popup-folder">📁 ${a.folder}</span>`;
                    if (a.observaciones) popupContent += `<br><span class="popup-obs">${a.observaciones}</span>`;

                    // Add photo if exists
                    if (a.foto) {
                        popupContent += `<div class="popup-photo"><img src="${a.foto}" alt="Foto de astilla"></div>`;
                    }
                    popupContent += `</div>`;

                    L.marker([a.lat, a.lng], {
                        icon: L.divIcon({
                            className: 'custom-bone',
                            html: '🦴',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    })
                        .bindPopup(popupContent, { maxWidth: 200 })
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

    // Enhanced KML Parser - Supports Polygon, gx:Track, MultiGeometry
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
            if (!str) return [];
            return str.trim().split(/\s+/).map(pair => {
                const parts = pair.split(',');
                if (parts.length >= 2) {
                    // KML is Lon,Lat. Leaflet wants Lat,Lon.
                    const lat = parseFloat(parts[1]);
                    const lng = parseFloat(parts[0]);
                    if (isNaN(lat) || isNaN(lng)) return null;
                    return [lat, lng];
                }
                return null;
            }).filter(p => p !== null);
        };

        // Parse gx:coord format (used by Geo Tracker): "lon lat alt" separated by spaces/newlines
        const parseGxCoords = (trackElement) => {
            const coords = [];
            // gx:coord elements contain "lon lat alt"
            const gxCoords = trackElement.getElementsByTagName('gx:coord');
            for (let i = 0; i < gxCoords.length; i++) {
                const parts = gxCoords[i].textContent.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        coords.push([lat, lng]);
                    }
                }
            }
            return coords;
        };

        // Get name from placemark
        const getPlacemarkName = (element) => {
            // Walk up to find parent Placemark
            let current = element;
            while (current && current.tagName !== 'Placemark') {
                current = current.parentElement;
            }
            if (current) {
                const nameEl = current.getElementsByTagName('name')[0];
                if (nameEl) return nameEl.textContent;
            }
            return null;
        };

        // Process LineString elements
        const processLineStrings = () => {
            const elements = kml.getElementsByTagName('LineString');
            for (let i = 0; i < elements.length; i++) {
                const coordsNode = elements[i].getElementsByTagName('coordinates')[0];
                if (coordsNode) {
                    const points = parseCoords(coordsNode.textContent);
                    if (points.length > 1) {
                        const name = getPlacemarkName(elements[i]);
                        const line = L.polyline(points, {
                            color: color,
                            weight: 4,
                            opacity: 0.8
                        }).addTo(this.routesLayer);

                        if (name) {
                            line.bindPopup(`<b>${name}</b>`);
                        }
                        bounds.extend(line.getBounds());
                        foundCount++;
                    }
                }
            }
        };

        // Process Polygon elements
        const processPolygons = () => {
            const elements = kml.getElementsByTagName('Polygon');
            for (let i = 0; i < elements.length; i++) {
                // Outer boundary
                const outerBoundary = elements[i].getElementsByTagName('outerBoundaryIs')[0];
                if (outerBoundary) {
                    const coordsNode = outerBoundary.getElementsByTagName('coordinates')[0];
                    if (coordsNode) {
                        const points = parseCoords(coordsNode.textContent);
                        if (points.length > 2) {
                            const name = getPlacemarkName(elements[i]);
                            const polygon = L.polygon(points, {
                                color: color,
                                weight: 2,
                                fillColor: color,
                                fillOpacity: 0.2
                            }).addTo(this.routesLayer);

                            if (name) {
                                polygon.bindPopup(`<b>${name}</b>`);
                            }
                            bounds.extend(polygon.getBounds());
                            foundCount++;
                        }
                    }
                }
            }
        };

        // Process LinearRing (standalone, not inside Polygon)
        const processLinearRings = () => {
            const elements = kml.getElementsByTagName('LinearRing');
            for (let i = 0; i < elements.length; i++) {
                // Skip if inside a Polygon (already processed)
                if (elements[i].parentElement?.tagName === 'outerBoundaryIs' ||
                    elements[i].parentElement?.tagName === 'innerBoundaryIs') {
                    continue;
                }

                const coordsNode = elements[i].getElementsByTagName('coordinates')[0];
                if (coordsNode) {
                    const points = parseCoords(coordsNode.textContent);
                    if (points.length > 2) {
                        const name = getPlacemarkName(elements[i]);
                        const ring = L.polygon(points, {
                            color: color,
                            weight: 2,
                            fillColor: color,
                            fillOpacity: 0.2
                        }).addTo(this.routesLayer);

                        if (name) {
                            ring.bindPopup(`<b>${name}</b>`);
                        }
                        bounds.extend(ring.getBounds());
                        foundCount++;
                    }
                }
            }
        };

        // Process gx:Track elements (Geo Tracker format)
        const processGxTracks = () => {
            const tracks = kml.getElementsByTagName('gx:Track');
            for (let i = 0; i < tracks.length; i++) {
                const points = parseGxCoords(tracks[i]);
                if (points.length > 1) {
                    const name = getPlacemarkName(tracks[i]);
                    const track = L.polyline(points, {
                        color: color,
                        weight: 4,
                        opacity: 0.8
                    }).addTo(this.routesLayer);

                    if (name) {
                        track.bindPopup(`<b>${name}</b>`);
                    }
                    bounds.extend(track.getBounds());
                    foundCount++;
                }
            }

            // Also try gx:MultiTrack
            const multiTracks = kml.getElementsByTagName('gx:MultiTrack');
            for (let i = 0; i < multiTracks.length; i++) {
                const innerTracks = multiTracks[i].getElementsByTagName('gx:Track');
                for (let j = 0; j < innerTracks.length; j++) {
                    const points = parseGxCoords(innerTracks[j]);
                    if (points.length > 1) {
                        const name = getPlacemarkName(multiTracks[i]);
                        const track = L.polyline(points, {
                            color: color,
                            weight: 4,
                            opacity: 0.8
                        }).addTo(this.routesLayer);

                        if (name) {
                            track.bindPopup(`<b>${name}</b>`);
                        }
                        bounds.extend(track.getBounds());
                        foundCount++;
                    }
                }
            }
        };

        // Process Point elements
        const processPoints = () => {
            const elements = kml.getElementsByTagName('Point');
            for (let i = 0; i < elements.length; i++) {
                const coordsNode = elements[i].getElementsByTagName('coordinates')[0];
                if (coordsNode) {
                    const points = parseCoords(coordsNode.textContent);
                    if (points.length > 0) {
                        const name = getPlacemarkName(elements[i]);
                        const marker = L.circleMarker(points[0], {
                            radius: 6,
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.6
                        }).addTo(this.routesLayer);

                        if (name) {
                            marker.bindPopup(`<b>${name}</b>`);
                        }
                        bounds.extend(L.latLngBounds(points));
                        foundCount++;
                    }
                }
            }
        };

        // Execute all parsers
        processLineStrings();
        processPolygons();
        processLinearRings();
        processGxTracks();
        processPoints();

        // Fallback: Search for any <coordinates> not yet processed
        if (foundCount === 0) {
            const allCoords = kml.getElementsByTagName('coordinates');
            for (let i = 0; i < allCoords.length; i++) {
                const points = parseCoords(allCoords[i].textContent);
                if (points.length > 1) {
                    const poly = L.polyline(points, { color: color, weight: 4 }).addTo(this.routesLayer);
                    bounds.extend(poly.getBounds());
                    foundCount++;
                } else if (points.length === 1) {
                    L.circleMarker(points[0], { radius: 6, color: color }).addTo(this.routesLayer);
                    bounds.extend(L.latLngBounds(points));
                    foundCount++;
                }
            }
        }

        if (foundCount > 0) {
            this.map.fitBounds(bounds);
            return { success: true, message: `Se cargaron ${foundCount} elementos.` };
        } else {
            return { success: false, message: "No se encontraron coordenadas válidas en el archivo KML." };
        }
    }
    // --- Real-time Location Tracking (Enhanced) ---

    toggleTracking(enable, onUpdate) {
        if (enable) {
            if (this.isTracking) return; // Already tracking

            if (!navigator.geolocation) {
                alert("Geolocalización no soportada en este navegador.");
                return;
            }

            this.isTracking = true;
            this.onTrackingUpdate = onUpdate;
            this.pathCoords = []; // Reset path for new session
            this.lastPosition = null;

            // Request Wake Lock to keep device awake for background tracking
            this.requestWakeLock();

            // Create user marker if not exist
            if (!this.userMarker) {
                this.userMarker = L.circleMarker([0, 0], {
                    radius: 10,
                    fillColor: '#2196F3',
                    color: '#fff',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 0.9,
                    className: 'user-marker-pulse'
                }).addTo(this.map);
                this.userMarker.bindPopup("Tu ubicación actual");
            }

            // Create accuracy circle
            if (!this.accuracyCircle) {
                this.accuracyCircle = L.circle([0, 0], {
                    radius: 10,
                    fillColor: '#2196F3',
                    fillOpacity: 0.15,
                    color: '#2196F3',
                    weight: 1,
                    opacity: 0.3
                }).addTo(this.map);
            }

            // Create or reset path line
            if (!this.userPath) {
                this.userPath = L.polyline([], {
                    color: '#00E676',
                    weight: 4,
                    opacity: 0.9,
                    lineJoin: 'round',
                    lineCap: 'round'
                }).addTo(this.map);
            } else {
                this.userPath.setLatLngs([]);
            }

            // High precision GPS settings
            this.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    this.handlePositionUpdate(position);
                },
                (error) => {
                    console.error("Error watching position:", error);
                    this.handleGPSError(error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,        // Only fresh positions
                    timeout: 10000        // 10 second timeout
                }
            );

            // Save tracking state for recovery
            this.saveTrackingState();

        } else {
            // Stop tracking
            this.isTracking = false;
            if (this.watchId !== null) {
                navigator.geolocation.clearWatch(this.watchId);
                this.watchId = null;
            }

            // Release Wake Lock
            this.releaseWakeLock();

            // Stop background save interval
            this.stopBackgroundSave();

            // Remove accuracy circle when stopping
            if (this.accuracyCircle) {
                this.map.removeLayer(this.accuracyCircle);
                this.accuracyCircle = null;
            }

            // Clear tracking state
            this.clearTrackingState();
        }
    }

    handlePositionUpdate(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const speed = position.coords.speed; // m/s, can be null
        const heading = position.coords.heading; // degrees, can be null

        // Update stats
        this.trackingStats = {
            accuracy: Math.round(accuracy),
            speed: speed !== null ? (speed * 3.6).toFixed(1) : null, // Convert to km/h
            heading: heading !== null ? Math.round(heading) : null,
            lastUpdate: new Date().toLocaleTimeString()
        };

        // Update accuracy circle
        if (this.accuracyCircle) {
            this.accuracyCircle.setLatLng([lat, lng]);
            this.accuracyCircle.setRadius(accuracy);

            // Change color based on accuracy
            if (accuracy <= 10) {
                this.accuracyCircle.setStyle({ fillColor: '#00E676', color: '#00E676' }); // Excellent - Green
            } else if (accuracy <= 30) {
                this.accuracyCircle.setStyle({ fillColor: '#2196F3', color: '#2196F3' }); // Good - Blue
            } else if (accuracy <= 50) {
                this.accuracyCircle.setStyle({ fillColor: '#FFC107', color: '#FFC107' }); // Fair - Yellow
            } else {
                this.accuracyCircle.setStyle({ fillColor: '#FF5722', color: '#FF5722' }); // Poor - Red
            }
        }

        // Update position
        this.updateUserLocation(lat, lng, accuracy);

        // Callback
        if (this.onTrackingUpdate) {
            this.onTrackingUpdate({
                lat,
                lng,
                accuracy: this.trackingStats.accuracy,
                speed: this.trackingStats.speed,
                heading: this.trackingStats.heading
            });
        }
    }

    handleGPSError(error) {
        let message = "Error de GPS: ";
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message += "Permiso de ubicación denegado. Por favor habilita el GPS.";
                break;
            case error.POSITION_UNAVAILABLE:
                message += "Ubicación no disponible. Verifica que el GPS esté activo.";
                break;
            case error.TIMEOUT:
                message += "Tiempo de espera agotado. Intentando nuevamente...";
                // Don't stop on timeout, let it retry
                return;
            default:
                message += error.message;
        }
        alert(message);
        this.toggleTracking(false);
    }

    setRecordingPath(enabled) {
        this.isRecordingPath = enabled;
        if (enabled && this.isTracking && this.pathCoords.length === 0 && this.userMarker) {
            // Start recording from current position
            const latLng = this.userMarker.getLatLng();
            if (latLng.lat !== 0 && latLng.lng !== 0) {
                this.pathCoords.push([latLng.lat, latLng.lng]);
            }
        }
        // Update visual style based on recording state
        if (this.userPath) {
            this.userPath.setStyle({
                color: enabled ? '#00E676' : '#2196F3',
                dashArray: enabled ? null : '5, 10'
            });
        }
        // Save state
        this.saveTrackingState();
    }

    updateUserLocation(lat, lng, accuracy) {
        if (!this.map) return;
        const latLng = [lat, lng];

        // Stabilization filter for marker - avoid jittery movement from GPS noise
        const MARKER_MIN_MOVEMENT = 2; // meters - only move marker if moved more than this

        // Update Marker with stabilization
        if (this.userMarker) {
            const currentMarkerPos = this.userMarker.getLatLng();

            // Only update marker if it's the first reading or moved significantly
            if (currentMarkerPos.lat === 0 && currentMarkerPos.lng === 0) {
                // First reading - update immediately
                this.userMarker.setLatLng(latLng);
                this.map.setView(latLng, 16); // Center on first location
            } else {
                // Calculate distance from current marker position
                const distance = currentMarkerPos.distanceTo(L.latLng(latLng));

                // Only move marker if significant movement detected
                if (distance >= MARKER_MIN_MOVEMENT) {
                    this.userMarker.setLatLng(latLng);

                    // Auto-pan only if user is near edge of view
                    const mapBounds = this.map.getBounds();
                    const padding = 0.2; // 20% padding
                    const latPad = (mapBounds.getNorth() - mapBounds.getSouth()) * padding;
                    const lngPad = (mapBounds.getEast() - mapBounds.getWest()) * padding;

                    const innerBounds = L.latLngBounds(
                        [mapBounds.getSouth() + latPad, mapBounds.getWest() + lngPad],
                        [mapBounds.getNorth() - latPad, mapBounds.getEast() - lngPad]
                    );

                    if (!innerBounds.contains(latLng)) {
                        this.map.panTo(latLng);
                    }
                }
            }
        }

        // Update accuracy circle (this can update more frequently)
        if (this.accuracyCircle) {
            this.accuracyCircle.setLatLng(latLng);
            this.accuracyCircle.setRadius(accuracy);
        }

        // Update Path - Only if recording AND accuracy is acceptable
        if (this.isRecordingPath) {
            // Filter out inaccurate points
            if (accuracy > this.MAX_ACCURACY_THRESHOLD) {
                console.log(`Skipping point due to poor accuracy: ${accuracy}m`);
                return;
            }

            // Check minimum movement threshold
            if (this.lastPosition) {
                const lastLatLng = L.latLng(this.lastPosition);
                const currentLatLng = L.latLng(latLng);
                const distance = lastLatLng.distanceTo(currentLatLng);

                if (distance < this.MIN_MOVEMENT_THRESHOLD) {
                    // Not enough movement, skip this point
                    return;
                }
            }

            // Add point to path with timestamp
            this.pathCoords.push(latLng);
            this.lastPosition = latLng;
            this.lastGPSTimestamp = Date.now();

            if (this.userPath) {
                this.userPath.setLatLngs(this.pathCoords);
            }

            // AGGRESSIVE SAVE: Persist every point immediately to prevent data loss
            this.saveTrackingState();
        }
    }

    getPathInfo() {
        const info = {
            points: this.pathCoords.length,
            distance: 0,
            accuracy: this.trackingStats.accuracy,
            speed: this.trackingStats.speed,
            lastUpdate: this.trackingStats.lastUpdate
        };

        if (this.pathCoords.length > 1) {
            // Calculate total distance
            for (let i = 1; i < this.pathCoords.length; i++) {
                const from = L.latLng(this.pathCoords[i - 1]);
                const to = L.latLng(this.pathCoords[i]);
                info.distance += from.distanceTo(to);
            }
            info.distance = Math.round(info.distance);
        }

        return info;
    }

    getTrackingStats() {
        return this.trackingStats;
    }

    saveCurrentPath() {
        if (!this.pathCoords || this.pathCoords.length < 2) {
            return { success: false, message: "No hay suficientes puntos para guardar (mínimo 2)" };
        }

        // Generate KML from current path
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const name = `Recorrido_${timestamp}`;
        const info = this.getPathInfo();

        // Build KML with metadata
        let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <description>Distancia: ${info.distance >= 1000 ? (info.distance / 1000).toFixed(2) + ' km' : info.distance + ' m'} | Puntos: ${info.points}</description>
    <Style id="trackStyle">
      <LineStyle>
        <color>ff00E676</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${name}</name>
      <styleUrl>#trackStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
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
        this.lastPosition = null;
        if (this.userPath) {
            this.userPath.setLatLngs([]);
        }
        this.isRecordingPath = false;
        this.clearTrackingState();
    }

    // --- Persistence for tracking recovery ---

    saveTrackingState() {
        const state = {
            isTracking: this.isTracking,
            isRecordingPath: this.isRecordingPath,
            pathCoords: this.pathCoords,
            timestamp: Date.now()
        };
        try {
            localStorage.setItem('paleoTrackingState', JSON.stringify(state));
        } catch (e) {
            console.warn('Could not save tracking state:', e);
        }
    }

    clearTrackingState() {
        try {
            localStorage.removeItem('paleoTrackingState');
        } catch (e) {
            console.warn('Could not clear tracking state:', e);
        }
    }

    restoreTrackingState() {
        try {
            const savedState = localStorage.getItem('paleoTrackingState');
            if (savedState) {
                const state = JSON.parse(savedState);
                // Only restore if less than 1 hour old
                const oneHour = 60 * 60 * 1000;
                if (Date.now() - state.timestamp < oneHour && state.pathCoords && state.pathCoords.length > 0) {
                    // Dispatch custom event so app.js can handle the UI update
                    const event = new CustomEvent('tracking-state-found', {
                        detail: {
                            pathCoords: state.pathCoords,
                            wasRecording: state.isRecordingPath
                        }
                    });
                    document.dispatchEvent(event);
                } else {
                    // Too old, clear it
                    this.clearTrackingState();
                }
            }
        } catch (e) {
            console.warn('Could not restore tracking state:', e);
        }
    }

    // Restore a previously saved path (called from app.js if user confirms)
    restorePath(pathCoords) {
        if (pathCoords && pathCoords.length > 0) {
            this.pathCoords = pathCoords;
            if (this.userPath) {
                this.userPath.setLatLngs(pathCoords);
            }
            // Set last position to last point
            this.lastPosition = pathCoords[pathCoords.length - 1];
        }
    }
}

