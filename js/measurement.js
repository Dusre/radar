import { state } from './state.js';

let measurementState = {
    isActive: false,
    points: [],
    markers: [],
    line: null,
    distanceLabel: null,
    touchTimeout: null
};

let map = null;

export function setMap(mapInstance) {
    map = mapInstance;
}

function calculateDistance(latlng1, latlng2) {
    // For EPSG:3067 (Finnish coordinate system), we can calculate distance more accurately
    // Convert to projected coordinates for accurate distance calculation
    const point1 = map.project(latlng1);
    const point2 = map.project(latlng2);
    
    // Calculate distance in projected coordinates (meters)
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // The distance is in projected units, need to convert based on zoom level
    // For EPSG:3067, the units are already in meters
    const zoom = map.getZoom();
    const resolution = getResolution(zoom);
    const distanceMeters = distance * resolution;
    
    return distanceMeters;
}

function getResolution(zoom) {
    // Resolutions for EPSG:3067 as defined in map setup
    const resolutions = [8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5];
    const zoomIndex = Math.floor(zoom);
    
    if (zoomIndex >= 0 && zoomIndex < resolutions.length) {
        // Interpolate between zoom levels for fractional zooms
        const fraction = zoom - zoomIndex;
        if (fraction > 0 && zoomIndex < resolutions.length - 1) {
            const res1 = resolutions[zoomIndex];
            const res2 = resolutions[zoomIndex + 1];
            return res1 + (res2 - res1) * fraction;
        }
        return resolutions[zoomIndex];
    }
    
    return resolutions[resolutions.length - 1];
}

function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(2)} km`;
    }
}

function createMeasurementMarker(latlng) {
    const marker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'measurement-marker-icon',
            html: `<div class="measurement-marker"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        }),
        interactive: false
    });
    
    return marker;
}

function updateMeasurement() {
    if (measurementState.points.length === 2) {
        const distance = calculateDistance(measurementState.points[0], measurementState.points[1]);
        const formattedDistance = formatDistance(distance);
        
        // Update result display
        document.getElementById('measure-result').textContent = `Etäisyys: ${formattedDistance}`;
        
        // Create or update line
        if (measurementState.line) {
            map.removeLayer(measurementState.line);
        }
        
        measurementState.line = L.polyline(measurementState.points, {
            className: 'measurement-line',
            interactive: false
        }).addTo(map);
        
        // Add distance label at midpoint
        const midpoint = L.latLng(
            (measurementState.points[0].lat + measurementState.points[1].lat) / 2,
            (measurementState.points[0].lng + measurementState.points[1].lng) / 2
        );
        
        if (measurementState.distanceLabel) {
            map.removeLayer(measurementState.distanceLabel);
        }
        
        measurementState.distanceLabel = L.marker(midpoint, {
            icon: L.divIcon({
                className: 'measurement-distance-label-icon',
                html: `<div class="measurement-label">${formattedDistance}</div>`,
                iconSize: null,
                iconAnchor: [0, 0]
            }),
            interactive: false
        }).addTo(map);
    }
}

function addMeasurementPoint(latlng) {
    if (measurementState.points.length >= 2) {
        clearMeasurement();
    }
    
    measurementState.points.push(latlng);
    
    // Add marker for this point (without label)
    const marker = createMeasurementMarker(latlng);
    marker.addTo(map);
    measurementState.markers.push(marker);
    
    // Update instructions
    const instructions = document.querySelector('.measure-instructions');
    if (measurementState.points.length === 1) {
        instructions.textContent = 'Klikkaa toinen piste';
    } else {
        instructions.textContent = 'Mittaus valmis';
    }
    
    updateMeasurement();
}

function handleMapClick(e) {
    if (!measurementState.isActive) return;
    addMeasurementPoint(e.latlng);
}

function handleTouchStart(e) {
    if (!measurementState.isActive) return;
    
    // Clear any existing timeout
    if (measurementState.touchTimeout) {
        clearTimeout(measurementState.touchTimeout);
    }
    
    // Set a timeout to distinguish between tap and drag
    measurementState.touchTimeout = setTimeout(() => {
        if (e.touches && e.touches.length === 1) {
            const touch = e.touches[0];
            const latlng = map.containerPointToLatLng([touch.clientX, touch.clientY]);
            addMeasurementPoint(latlng);
        }
    }, 200); // 200ms delay to distinguish tap from drag
}

function handleTouchMove(e) {
    // If user moves finger, cancel the measurement
    if (measurementState.touchTimeout) {
        clearTimeout(measurementState.touchTimeout);
        measurementState.touchTimeout = null;
    }
}

function handleTouchEnd(e) {
    // Clear timeout on touch end
    if (measurementState.touchTimeout) {
        clearTimeout(measurementState.touchTimeout);
        measurementState.touchTimeout = null;
    }
}

export function clearMeasurement() {
    // Remove all markers
    measurementState.markers.forEach(marker => map.removeLayer(marker));
    measurementState.markers = [];
    
    // Remove line
    if (measurementState.line) {
        map.removeLayer(measurementState.line);
        measurementState.line = null;
    }
    
    // Remove distance label
    if (measurementState.distanceLabel) {
        map.removeLayer(measurementState.distanceLabel);
        measurementState.distanceLabel = null;
    }
    
    // Reset state
    measurementState.points = [];
    
    // Update UI
    document.getElementById('measure-result').textContent = '';
    document.querySelector('.measure-instructions').textContent = 'Klikkaa kahta pistettä kartalla';
}

export function toggleMeasurement() {
    measurementState.isActive = !measurementState.isActive;
    
    const button = document.getElementById('measure-btn');
    const info = document.getElementById('measure-info');
    
    if (measurementState.isActive) {
        button.classList.add('active');
        info.classList.remove('hidden');
        map.getContainer().style.cursor = 'crosshair';
        
        // Add both click and touch handlers
        map.on('click', handleMapClick);
        
        // For mobile support
        const mapContainer = map.getContainer();
        mapContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        mapContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        mapContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        // Temporarily disable double-tap zoom on mobile
        map.doubleClickZoom.disable();
        
        // Show mobile-friendly instructions
        const isMobile = 'ontouchstart' in window;
        const instructions = document.querySelector('.measure-instructions');
        instructions.textContent = isMobile ? 'Kosketa kahta pistettä kartalla' : 'Klikkaa kahta pistettä kartalla';
        
    } else {
        button.classList.remove('active');
        info.classList.add('hidden');
        map.getContainer().style.cursor = '';
        
        // Remove handlers
        map.off('click', handleMapClick);
        
        const mapContainer = map.getContainer();
        mapContainer.removeEventListener('touchstart', handleTouchStart);
        mapContainer.removeEventListener('touchmove', handleTouchMove);
        mapContainer.removeEventListener('touchend', handleTouchEnd);
        
        // Re-enable double-tap zoom
        map.doubleClickZoom.enable();
        
        // Clear any existing measurement
        clearMeasurement();
        
        // Clear any pending touch timeout
        if (measurementState.touchTimeout) {
            clearTimeout(measurementState.touchTimeout);
            measurementState.touchTimeout = null;
        }
    }
}

export function initializeMeasurement() {
    // Measurement tool button
    document.getElementById('measure-btn').addEventListener('click', (e) => {
        e.preventDefault();
        toggleMeasurement();
    });
    
    // Clear measurement button
    document.getElementById('clear-measure-btn').addEventListener('click', (e) => {
        e.preventDefault();
        clearMeasurement();
    });
    
    // Keyboard shortcut (Escape to exit measurement mode)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && measurementState.isActive) {
            toggleMeasurement();
        }
    });
}