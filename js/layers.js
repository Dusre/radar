import { state, layers } from './state.js';
import { CONFIG } from './config.js';
import {
    formatTime,
    getColorForTemperature,
    getColorForHumidity,
    getColorForPressure,
    getCloudIcon,
    degreesToCardinal,
    getTemperatureExtreme,
    getPressureBackground,
    getColorForWind,
    getWindArrowColor
} from './utils.js';
import { fetchWeatherParameter, fetchWindData } from './data-fetchers.js';
import { createRadarLayer } from './map.js';

let map = null;

export function setMap(mapInstance) {
    map = mapInstance;
}

export function updateLightning() {
    layers.lightning.clearLayers();
    const toggle = document.getElementById('lightning-toggle');

    if (!toggle || !toggle.checked) {
        return;
    }

    const nowTs = Date.now();
    const visibleFeatures = state.lightningData.features.filter(f =>
        (nowTs - f.properties.timestamp) / 60000 < CONFIG.MAX_STRIKE_AGE_MINUTES
    );

    layers.lightning.addData({
        type: 'FeatureCollection',
        features: visibleFeatures
    });

}

export async function updateTemperatureLayer() {
    const isVisible = document.getElementById('temperature-toggle').checked;

    if (!isVisible) {
        if (map.hasLayer(layers.temperature)) {
            map.removeLayer(layers.temperature);
        }
        layers.temperature.clearLayers();
        return;
    }

    if (!map.hasLayer(layers.temperature)) {
        map.addLayer(layers.temperature);
    }

    const status = document.getElementById('status');
    const originalText = status.textContent;
    status.textContent = 'Ladataan lämpötiloja...';
    status.className = 'status loading';

    const tempData = await fetchWeatherParameter('temperature');

    layers.temperature.clearLayers();

    tempData.forEach(station => {
        if (station.value < -50 || station.value > 50) return;

        const bgColor = getColorForTemperature(station.value);
        const extreme = getTemperatureExtreme(station.value);

        const label = L.marker([station.lat, station.lng], {
            icon: L.divIcon({
                className: 'temp-label' + (extreme ? ` temp-label--${extreme}` : ''),
                html: `<div style="background: ${bgColor};">${station.value.toFixed(0)}°C</div>`,
                iconSize: null, // Let CSS handle sizing
                iconAnchor: [0, 0] // Will be adjusted by CSS transform
            })
        });

        const ageMinutes = Math.round((Date.now() - station.time.getTime()) / 60000);
        const popupContent = `
		<strong>🌡️ Lämpötila-asema</strong><br>
		<div style="margin-top: 8px;">
		📍 <strong>${station.stationName}</strong><br>
		🌡️ Lämpötila: <strong style="color: #4db8ff;">${station.value.toFixed(1)}°C</strong><br>
		⏰ Aika: ${formatTime(station.time)}<br>
		⏱️ Ikä: ${ageMinutes} minuuttia sitten<br>
		📌 Sijainti: ${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}
		</div>
        `;

        label.bindPopup(popupContent, { className: 'dark-popup' });
        layers.temperature.addLayer(label);
    });

    if (status.textContent === 'Ladataan lämpötiloja...') {
        status.textContent = (!originalText || originalText.includes('Ladataan')) ? 'Valmis' : originalText;
        status.className = 'status success';
    }
}

export async function updateWindLayer() {
    const isVisible = document.getElementById('wind-toggle').checked;

    if (!isVisible) {
        if (map.hasLayer(layers.wind)) {
            map.removeLayer(layers.wind);
        }
        layers.wind.clearLayers();
        return;
    }

    if (!map.hasLayer(layers.wind)) {
        map.addLayer(layers.wind);
    }

    const status = document.getElementById('status');
    const originalText = status.textContent;
    status.textContent = 'Ladataan tuulta...';
    status.className = 'status loading';

    const data = await fetchWindData();
    layers.wind.clearLayers();

    data.forEach(obs => {
        const speed = Math.max(0, Math.min(60, obs.speed));
        const direction = ((obs.direction % 360) + 360) % 360;

        const length = 8 + Math.min(speed, 12);
        const svgWidth = 12;
        const svgHeight = length + 6;

        const arrowColor = getWindArrowColor(speed);
        const bgColor = getColorForWind(speed);

        // Double-stroke arrow - looks like shadow but fast!
        const arrowSVG = `
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#000" stroke-width="4" stroke-linecap="round" fill="none">
        <line x1="${svgWidth / 2}" y1="${svgHeight - 2}" x2="${svgWidth / 2}" y2="${svgHeight - length}" />
        <path d="M ${svgWidth / 2} ${svgHeight - length} L ${svgWidth / 2 - 3} ${svgHeight - length + 6} M ${svgWidth / 2} ${svgHeight - length} L ${svgWidth / 2 + 3} ${svgHeight - length + 6}" />
        </g>
        <g stroke="${arrowColor}" stroke-width="2" stroke-linecap="round" fill="none">
        <line x1="${svgWidth / 2}" y1="${svgHeight - 2}" x2="${svgWidth / 2}" y2="${svgHeight - length}" />
        <path d="M ${svgWidth / 2} ${svgHeight - length} L ${svgWidth / 2 - 3} ${svgHeight - length + 6} M ${svgWidth / 2} ${svgHeight - length} L ${svgWidth / 2 + 3} ${svgHeight - length + 6}" />
        </g>
        </svg>`;

        const marker = L.marker([obs.lat, obs.lng], {
            icon: L.divIcon({
                className: 'wind-label',
                html: `
                    <div class="wind-arrow" style="transform: rotate(${(direction + 180) % 360}deg);">${arrowSVG}</div>
                    <div style="background: ${bgColor};">${speed.toFixed(1)} m/s</div>
                `,
                iconSize: null,
                iconAnchor: [0, 0]
            })
        });

        const ageMinutes = Math.round((Date.now() - new Date(obs.time).getTime()) / 60000);
        const popupContent = `
        <strong>🌬️ Tuuli</strong><br>
        <div style="margin-top: 8px;">
        📍 <strong>${obs.stationName}</strong><br>
        💨 Nopeus: <strong style="color: #4db8ff;">${speed.toFixed(1)} m/s</strong><br>
        🧭 Suunta: ${Math.round(direction)}° (${degreesToCardinal(direction)})<br>
        ⏰ Aika: ${formatTime(new Date(obs.time))}<br>
        ⏱️ Ikä: ${ageMinutes} minuuttia sitten
        </div>
        `;

        marker.bindPopup(popupContent, { className: 'dark-popup' });
        layers.wind.addLayer(marker);
    });

    if (status.textContent === 'Ladataan tuulta...') {
        status.textContent = (!originalText || originalText.includes('Ladataan')) ? 'Valmis' : originalText;
        status.className = 'status success';
    }
}


export async function updateCloudLayer() {
    const isVisible = document.getElementById('clouds-toggle').checked;

    if (!isVisible) {
        if (map.hasLayer(layers.clouds)) {
            map.removeLayer(layers.clouds);
        }
        layers.clouds.clearLayers();
        return;
    }

    if (!map.hasLayer(layers.clouds)) {
        map.addLayer(layers.clouds);
    }

    const status = document.getElementById('status');
    const originalText = status.textContent;
    status.textContent = 'Ladataan pilvisyyttä...';
    status.className = 'status loading';

    const cloudData = await fetchWeatherParameter('n_man');

    layers.clouds.clearLayers();

    cloudData.forEach(station => {
        const coverage = Math.round(station.value);
        if (coverage < 0 || coverage > 8) return;

        const cloudInfo = getCloudIcon(coverage);
        const percentage = Math.round((coverage / 8) * 100);

        const marker = L.marker([station.lat, station.lng], {
            icon: L.divIcon({
                className: 'cloud-label',
                html: `
				<div class="cloud-icon-container">
                <div class="cloud-icon" style="color: ${cloudInfo.color};">${cloudInfo.icon}</div>
                <div class="cloud-percentage">${percentage}%</div>
				</div>
				`,
                iconSize: null, // Let CSS handle sizing
                iconAnchor: [0, 0] // Will be centered by CSS
            })
        });

        const ageMinutes = Math.round((Date.now() - station.time.getTime()) / 60000);
        const popupContent = `
		<strong>Pilvisyys</strong><br>
		Asema: ${station.stationName}<br>
		Pilvisyys: <strong>${percentage}% (${coverage}/8)</strong><br>
		Tila: ${cloudInfo.description}<br>
		Aika: ${formatTime(station.time)}<br>
		Ikä: ${ageMinutes} minuuttia sitten<br>
		Sijainti: ${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}
        `;

        marker.bindPopup(popupContent, { className: 'dark-popup' });
        layers.clouds.addLayer(marker);
    });

    if (status.textContent === 'Ladataan pilvisyyttä...') {
        status.textContent = (!originalText || originalText.includes('Ladataan')) ? 'Valmis' : originalText;
        status.className = 'status success';
    }
}

export async function updateHumidityLayer() {
    const toggle = document.getElementById('humidity-toggle');
    if (!toggle || !toggle.checked) {
        if (map.hasLayer(layers.humidity)) {
            map.removeLayer(layers.humidity);
        }
        layers.humidity.clearLayers();
        return;
    }

    if (!map.hasLayer(layers.humidity)) {
        map.addLayer(layers.humidity);
    }

    const status = document.getElementById('status');
    const original = status.textContent;
    status.textContent = 'Ladataan kosteutta...';
    status.className = 'status loading';

    const data = await fetchWeatherParameter('humidity');
    layers.humidity.clearLayers();

    data.forEach(obs => {
        const color = getColorForHumidity(obs.value);
        const label = L.marker([obs.lat, obs.lng], {
            icon: L.divIcon({
                className: 'humidity-label',
                html: `<div style="background: ${color};">${obs.value.toFixed(0)}%</div>`,
                iconSize: null,
                iconAnchor: [0, 0]
            })
        });

        const age = Math.round((Date.now() - new Date(obs.time).getTime()) / 60000);
        const popupContent = `
        <strong>💧 Ilmankosteus</strong><br>
        <div style="margin-top: 8px;">
		📍 <strong>${obs.stationName}</strong><br>
		💧 RH: <strong style="color: #4db8ff;">${obs.value.toFixed(0)}%</strong><br>
		⏰ Aika: ${formatTime(new Date(obs.time))}<br>
		⏱️ Ikä: ${age} minuuttia sitten
        </div>
		`;

        label.bindPopup(popupContent, { className: 'dark-popup' });
        layers.humidity.addLayer(label);
    });

    if (status.textContent === 'Ladataan kosteutta...') {
        status.textContent = (!original || original.includes('Ladataan')) ? 'Valmis' : original;
        status.className = 'status success';
    }
}

export async function updatePressureLayer() {
    const toggle = document.getElementById('pressure-toggle');
    if (!toggle || !toggle.checked) {
        if (map.hasLayer(layers.pressure)) {
            map.removeLayer(layers.pressure);
        }
        layers.pressure.clearLayers();
        return;
    }

    if (!map.hasLayer(layers.pressure)) {
        map.addLayer(layers.pressure);
    }

    const status = document.getElementById('status');
    const original = status.textContent;
    status.textContent = 'Ladataan painetta...';
    status.className = 'status loading';

    const data = await fetchWeatherParameter('pressure');
    layers.pressure.clearLayers();

    data.forEach(obs => {
        const indicatorColor = getColorForPressure(obs.value);
        const bgColor = getPressureBackground(obs.value);

        const label = L.marker([obs.lat, obs.lng], {
            icon: L.divIcon({
                className: 'pressure-label',
                html: `<div style="background: ${bgColor}; --indicator-color: ${indicatorColor};">${obs.value.toFixed(0)} hPa</div>`,
                iconSize: null,
                iconAnchor: [0, 0]
            })
        });

        const age = Math.round((Date.now() - new Date(obs.time).getTime()) / 60000);
        const popupContent = `
        <strong>🔵 Ilmanpaine</strong><br>
        <div style="margin-top: 8px;">
		📍 <strong>${obs.stationName}</strong><br>
		🔵 Paine: <strong style="color: #4db8ff;">${obs.value.toFixed(1)} hPa</strong><br>
		⏰ Aika: ${formatTime(new Date(obs.time))}<br>
		⏱️ Ikä: ${age} minuuttia sitten
        </div>
		`;

        label.bindPopup(popupContent, { className: 'dark-popup' });
        layers.pressure.addLayer(label);
    });

    if (status.textContent === 'Ladataan painetta...') {
        status.textContent = (!original || original.includes('Ladataan')) ? 'Valmis' : original;
        status.className = 'status success';
    }
}

// ---------------------------------------------------------------------------
// Radar (double-buffered)
//
// Only one radar layer is visible at a time (layers.fmiRadar). To change frame,
// a second layer is added hidden (opacity 0), loaded with the new time, and
// swapped in once all its tiles have arrived, so the old frame stays on screen
// until the new one is ready. The old layer is then removed from the map and
// kept as a spare for the next change.
// ---------------------------------------------------------------------------

const RADAR_SETTLE_MS = 250;    // let Leaflet's ~200 ms tile fade-in finish before swapping
const RADAR_FALLBACK_MS = 5000; // swap anyway if 'load' never fires

let radarOpacity = 0.7;
let pendingRadar = null;  // loading, hidden
let spareRadar = null;    // off the map, ready for reuse
let radarToken = 0;
let radarSettleTimer = null;
let radarFallbackTimer = null;

export function setRadarOpacity(value) {
    radarOpacity = value;
    if (layers.fmiRadar) layers.fmiRadar.setOpacity(value);
}

/**
 * Rewrites a radar layer's WMS params in place for the given time (null = live).
 * Historical frames never change, so they get no cache-buster and can be served
 * from the browser cache. Live frames get one; during animation it stays
 * constant so preloaded tiles match what is drawn.
 */
function applyRadarParams(layer, time) {
    const p = layer.wmsParams;
    delete p.time;
    delete p._cacheBust;

    if (time) {
        p.time = time.toISOString();
    } else {
        p._cacheBust = state.isAnimating && state.animationCacheBust
            ? state.animationCacheBust
            : Date.now();
    }
}

function commitRadarFrame(incoming, token) {
    if (token !== radarToken || pendingRadar !== incoming) return;

    clearTimeout(radarSettleTimer);
    clearTimeout(radarFallbackTimer);
    incoming.off('load');

    const outgoing = layers.fmiRadar;
    incoming.setOpacity(radarOpacity);
    layers.fmiRadar = incoming;
    pendingRadar = null;

    if (outgoing && outgoing !== incoming) {
        map.removeLayer(outgoing);
        spareRadar = outgoing;
    }
}

export function updateRadarLayer() {
    const time = getHistoricalRadarTime();
    const token = ++radarToken;

    clearTimeout(radarSettleTimer);
    clearTimeout(radarFallbackTimer);

    // If a frame is still loading, retarget it instead of stacking another layer
    let incoming = pendingRadar;
    if (!incoming) {
        incoming = spareRadar || createRadarLayer(0);
        spareRadar = null;
        pendingRadar = incoming;
    }

    incoming.off('load');
    applyRadarParams(incoming, time);
    incoming.setOpacity(0);
    incoming.on('load', () => {
        clearTimeout(radarSettleTimer);
        radarSettleTimer = setTimeout(() => commitRadarFrame(incoming, token), RADAR_SETTLE_MS);
    });
    radarFallbackTimer = setTimeout(() => commitRadarFrame(incoming, token), RADAR_FALLBACK_MS);

    if (map.hasLayer(incoming)) {
        incoming.redraw();
    } else {
        incoming.addTo(map);
    }
}

/**
 * Returns the tile URLs the radar layer would request for the given history
 * step at the current map view, without changing what is displayed.
 */
export function getRadarTileUrls(step) {
    const layer = layers.fmiRadar;
    const snapshot = { ...layer.wmsParams };

    applyRadarParams(layer, step === 0 ? null : getRadarTimeForStep(step));

    const urls = Object.values(layer._tiles || {})
        .map(tile => tile.coords)
        .filter(coords => coords && coords.z === layer._tileZoom)
        .map(coords => layer.getTileUrl(coords));

    // Restore the params exactly as they were (including key order)
    Object.keys(layer.wmsParams).forEach(k => delete layer.wmsParams[k]);
    Object.assign(layer.wmsParams, snapshot);

    return urls;
}

export function getRadarTimeForStep(step) {
    if (step === 0) return null;
    if (state.availableRadarTimes.length > step) {
        return state.availableRadarTimes[step];
    }

    const minutesAgo = step * CONFIG.HISTORY_STEP_MINUTES;
    const time = new Date(Date.now() - minutesAgo * 60 * 1000);
    time.setMinutes(Math.floor(time.getMinutes() / 5) * 5);
    time.setSeconds(0);
    time.setMilliseconds(0);
    return time;
}

function getHistoricalRadarTime() {
    return getRadarTimeForStep(state.currentHistoryStep);
}