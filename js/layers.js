import { state, layers } from './state.js';
import { CONFIG } from './config.js';
import { formatTime, getColorForTemperature, getColorForHumidity, getColorForPressure, getCloudIcon, degreesToCardinal, getTemperatureExtreme, getPressureBackground } from './utils.js';
import { fetchWeatherParameter, fetchWindData } from './data-fetchers.js';

let map = null;

export function setMap(mapInstance) {
    map = mapInstance;
}

export function updateLightning() {
    layers.lightning.clearLayers();
    const toggle = document.getElementById('lightning-toggle');
    
    if (!toggle || !toggle.checked) {
        // document.getElementById('lightning-count').textContent = '0';
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
    
    // document.getElementById('lightning-count').textContent = visibleFeatures.length.toString();
}

export async function updateTemperatureLayer() {
    const isVisible = document.getElementById('temperature-toggle').checked;
    
    if (!isVisible) {
        if (map.hasLayer(layers.temperature)) {
            map.removeLayer(layers.temperature);
		}
        layers.temperature.clearLayers();
        state.temperatureStationCount = 0;
        // document.getElementById('temp-count').textContent = '0';
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
    state.temperatureStationCount = 0;
    
    tempData.forEach(station => {
        if (station.value < -50 || station.value > 50) return;
        
        const bgColor = getColorForTemperature(station.value);
        const extreme = getTemperatureExtreme(station.value);
        
        const label = L.marker([station.lat, station.lng], {
            icon: L.divIcon({
                className: 'temp-label' + (extreme ? ` temp-label[data-extreme="${extreme}"]` : ''),
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
        state.temperatureStationCount++;
	});
    
    status.textContent = originalText;
    status.className = 'status success';
    // document.getElementById('temp-count').textContent = state.temperatureStationCount;
}

export async function updateWindLayer() {
    const isVisible = document.getElementById('wind-toggle').checked;
    
    if (!isVisible) {
        if (map.hasLayer(layers.wind)) {
            map.removeLayer(layers.wind);
		}
        layers.wind.clearLayers();
        state.windStationCount = 0;
        // document.getElementById('wind-count').textContent = '0';
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
    state.windStationCount = 0;
    
    data.forEach(obs => {
        const speed = Math.max(0, Math.min(60, obs.speed));
        const direction = ((obs.direction % 360) + 360) % 360;
        const length = 10 + Math.min(speed, 15); // Longer arrow
		const svgWidth = 16; // Increased from smaller values
		const svgHeight = length + 10;
        
        const arrowSVG = `
		<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
		<filter id="shadow${state.windStationCount}" x="-50%" y="-50%" width="200%" height="200%">
		<feDropShadow dx="0" dy="0" stdDeviation="1" flood-color="#000" flood-opacity="0.6"/>
		</filter>
        </defs>
        <g filter="url(#shadow${state.windStationCount})" stroke="#00ff00" stroke-width="2.5" stroke-linecap="round" fill="none">
		<line x1="${svgWidth/2}" y1="${svgHeight-2}" x2="${svgWidth/2}" y2="${svgHeight-length}" />
		<path d="M ${svgWidth/2} ${svgHeight-length} L ${svgWidth/2 - 4} ${svgHeight-length + 8} M ${svgWidth/2} ${svgHeight-length} L ${svgWidth/2 + 4} ${svgHeight-length + 8}" />
        </g>
		</svg>`;
        
        // In the wind layer creation, update the icon creation:
		const marker = L.marker([obs.lat, obs.lng], {
			icon: L.divIcon({
				className: 'wind-icon',
				html: `<div style="transform: rotate(${direction}deg);">${arrowSVG}</div>
				<div>${speed.toFixed(1)} m/s</div>`,
				iconSize: null, // Let CSS handle sizing
				iconAnchor: [0, 0] // Centered by default
			})
		});
        
        const ageMinutes = Math.round((Date.now() - new Date(obs.time).getTime()) / 60000);
        const popupContent = `
		<strong>Tuuli</strong><br>
		Asema: ${obs.stationName}<br>
		Nopeus: <strong>${speed.toFixed(1)} m/s</strong><br>
		Suunta: ${Math.round(direction)}° (${degreesToCardinal(direction)})<br>
		Aika: ${formatTime(new Date(obs.time))}<br>
		Ikä: ${ageMinutes} minuuttia sitten
        `;
        
        marker.bindPopup(popupContent, { className: 'dark-popup' });
        layers.wind.addLayer(marker);
        state.windStationCount++;
	});
    
    // document.getElementById('wind-count').textContent = state.windStationCount.toString();
    status.textContent = originalText;
    status.className = 'status success';
}

export async function updateCloudLayer() {
    const isVisible = document.getElementById('clouds-toggle').checked;
    
    if (!isVisible) {
        if (map.hasLayer(layers.clouds)) {
            map.removeLayer(layers.clouds);
		}
        layers.clouds.clearLayers();
        state.cloudStationCount = 0;
        // document.getElementById('cloud-count').textContent = '0';
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
    state.cloudStationCount = 0;
    
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
        state.cloudStationCount++;
	});
    
    status.textContent = originalText;
    status.className = 'status success';
    // document.getElementById('cloud-count').textContent = state.cloudStationCount;
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
		
		const age = Math.round((Date.now() - new Date(obs.time).getTime())/60000);
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
    
    status.textContent = original;
    status.className = 'status success';
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
		
		const age = Math.round((Date.now() - new Date(obs.time).getTime())/60000);
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
    
    status.textContent = original;
    status.className = 'status success';
}

export function updateRadarLayer() {
    const historicalTime = getHistoricalRadarTime();
    const params = {
        layers: 'Radar:suomi_dbz_eureffin',
        format: 'image/png',
        transparent: true,
        _cacheBust: Date.now()
	};
    
    if (historicalTime) {
        params.time = historicalTime.toISOString();
		} else {
        if (layers.fmiRadar.wmsParams) {
            delete layers.fmiRadar.wmsParams.time;
		}
	}
    
    layers.fmiRadar.setParams(params);
}

function getHistoricalRadarTime() {
    if (state.currentHistoryStep === 0) return null;
    if (state.availableRadarTimes.length > state.currentHistoryStep) {
        return state.availableRadarTimes[state.currentHistoryStep];
	}
    
    const minutesAgo = state.currentHistoryStep * CONFIG.HISTORY_STEP_MINUTES;
    const time = new Date(Date.now() - minutesAgo * 60 * 1000);
    time.setMinutes(Math.floor(time.getMinutes() / 5) * 5);
    time.setSeconds(0);
    time.setMilliseconds(0);
    return time;
}