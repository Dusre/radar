import { layers } from './state.js';

// Define Finnish coordinate system
const proj4_3067_def = '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const crs_3067 = new L.Proj.CRS('EPSG:3067', proj4_3067_def, {
    resolutions: [8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5],
    origin: [-548576, 8388608]
});

// Get saved map position or use defaults
function getSavedMapPosition() {
    try {
        const saved = localStorage.getItem('mapPosition');
        if (saved) {
            const parsed = JSON.parse(saved);
            const lat = parseFloat(parsed.lat);
            const lng = parseFloat(parsed.lng);
            const zoom = parseInt(parsed.zoom, 10);
            
            if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
                return { center: [lat, lng], zoom };
            }
        }
    } catch (e) {
        console.error('Could not restore map position:', e);
    }
    return { center: [64.5, 26.0], zoom: 4 };
}

// Save map position on move
function saveMapPosition(map) {
    try {
        const position = {
            lat: map.getCenter().lat,
            lng: map.getCenter().lng,
            zoom: map.getZoom()
        };
        localStorage.setItem('mapPosition', JSON.stringify(position));
    } catch (e) {
        console.error('Could not save map position:', e);
    }
}

export function initializeMap() {
    const mapPosition = getSavedMapPosition();
    const map = L.map('map', {
        crs: crs_3067,
        minZoom: 1,
        maxZoom: 8,
        center: mapPosition.center,
        zoom: mapPosition.zoom,
        preferCanvas: true, 
        renderer: L.canvas()
    });
    
    // Save map position on move
    map.on('moveend', () => saveMapPosition(map));
    
    // Add base layers
    layers.localMap = L.tileLayer('local_tiles/{z}/{y}/{x}.png', {
        attribution: 'Maanmittauslaitos',
        minZoom: 1,
        maxZoom: 8,
        errorUrl: '',
        tms: false
    }).addTo(map);
    
    layers.fmiRadar = L.tileLayer.wms('https://openwms.fmi.fi/geoserver/Radar/wms', {
        layers: 'Radar:suomi_dbz_eureffin',
        format: 'image/png',
        transparent: true,
        opacity: 0.7,
        zIndex: 10,
        attribution: 'Säätutka © FMI',
        keepBuffer: 2,
        updateWhenIdle: false,
        updateWhenZooming: false
    }).addTo(map);
    
    // Initialize lightning layer with canvas renderer
    const canvasRenderer = L.canvas({ padding: 0.5 });
    layers.lightning = L.geoJSON(null, {
        renderer: canvasRenderer,
        pointToLayer: (feature, latlng) => {
            const ageMinutes = (Date.now() - feature.properties.timestamp) / 60000;
            let color = '#ffaa00';
            if (ageMinutes < 5) color = '#ff0000';
            else if (ageMinutes < 10) color = '#ff8800';
            
            return L.circleMarker(latlng, {
                radius: 4,
                fillColor: color,
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const ageMinutes = Math.round((Date.now() - props.timestamp) / 60000);
            const popupContent = `
                <strong>Salama</strong><br>
                Aika: ${new Date(props.timestamp).toLocaleTimeString('sv-SE', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit', 
                    hour12: false 
                })}<br>
                Voimakkuus: ${Math.round(props.intensity)} kA<br>
                Ikä: ${ageMinutes} minuuttia sitten
            `;
            layer.bindPopup(popupContent, { className: 'dark-popup' });
        }
    }).addTo(map);
    
    return map;
}