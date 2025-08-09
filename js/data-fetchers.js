import { fetchWithTimeout } from './utils.js';
import { state } from './state.js';

export async function fetchLightningData() {
    const statusEl = document.getElementById('status');
    try {
        statusEl.textContent = 'Ladataan salamoita...';
        statusEl.className = 'status loading';
        
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 30 * 60 * 1000);
        const url = `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::lightning::simple&starttime=${startTime.toISOString()}&endtime=${endTime.toISOString()}&bbox=19,59,32,71`;
        
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('XML parsing error');
        }
        
        const lightningData = parseLightningXML(xmlDoc);
        statusEl.textContent = `Ladattu ${lightningData.length} salamaa`;
        statusEl.className = 'status success';
        
        if (lightningData.length > 0) {
            const newestTimestamp = Math.max(...lightningData.map(d => d.timestamp));
            if (newestTimestamp > state.newestStrikeTimestamp) {
                state.newestStrikeTimestamp = newestTimestamp;
            }
        }
        
        state.lightningData = {
            type: 'FeatureCollection',
            features: lightningData.map(d => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [d.lng, d.lat]
                },
                properties: d
            }))
        };
    } catch (error) {
        console.error('Error fetching lightning data:', error);
        statusEl.textContent = `Virhe: ${error.message}`;
        statusEl.className = 'status error';
        state.lightningData = { type: 'FeatureCollection', features: [] };
    }
}

function parseLightningXML(xmlDoc) {
    const strikes = [];
    xmlDoc.querySelectorAll('wfs\\:member, member').forEach(member => {
        try {
            const element = member.querySelector('BsWfsElement');
            if (!element) return;
            
            const location = member.querySelector('Location');
            if (!location) return;
            
            const pos = location.querySelector('Point pos, pos');
            if (!pos) return;
            
            const coords = pos.textContent.trim().split(' ');
            if (coords.length < 2) return;
            
            const lat = parseFloat(coords[0]);
            const lng = parseFloat(coords[1]);
            if (isNaN(lat) || isNaN(lng)) return;
            
            const timeEl = member.querySelector('Time');
            const timestamp = timeEl ? new Date(timeEl.textContent.trim()).getTime() : Date.now();
            
            const intensityEl = member.querySelector('ParameterValue > ParameterValue');
            const intensity = intensityEl ? Math.abs(parseFloat(intensityEl.textContent)) : 50;
            
            strikes.push({ lat, lng, timestamp, intensity });
        } catch (error) {
            console.warn('Error parsing strike:', error);
        }
    });
    return strikes;
}

export async function fetchWeatherParameter(paramName) {
    try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 30 * 60 * 1000);
        const url = `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&parameters=${paramName}&starttime=${startTime.toISOString()}&endtime=${endTime.toISOString()}&bbox=19,59,32,71`;
        
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('XML parsing error');
        }
        
        return parseWeatherXML(xmlDoc);
    } catch (error) {
        console.error(`Error fetching ${paramName}:`, error);
        return [];
    }
}

function parseWeatherXML(xmlDoc) {
    const locations = new Map();
    
    xmlDoc.querySelectorAll('wfs\\:member, member').forEach(member => {
        try {
            const posElement = member.querySelector('gml\\:pos, pos');
            if (!posElement) return;
            
            const coords = posElement.textContent.trim().split(' ');
            if (coords.length < 2) return;
            
            const lat = parseFloat(coords[0]);
            const lng = parseFloat(coords[1]);
            if (isNaN(lat) || isNaN(lng)) return;
            
            const locationKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
            
            let stationNameEl = member.querySelector('gml\\:name[codeSpace="http://xml.fmi.fi/namespace/locationcode/name"], name[codeSpace="http://xml.fmi.fi/namespace/locationcode/name"]');
            const stationName = stationNameEl ? stationNameEl.textContent.trim() : 'Asema';
            
            const result = member.querySelector('om\\:result, result');
            if (!result) return;
            
            let latestMeasurement = null;
            result.querySelectorAll('wml2\\:MeasurementTVP, MeasurementTVP').forEach(measurement => {
                const timeEl = measurement.querySelector('wml2\\:time, time');
                const valueEl = measurement.querySelector('wml2\\:value, value');
                
                if (!timeEl || !valueEl) return;
                
                const valueStr = valueEl.textContent.trim();
                if (valueStr === '' || valueStr === 'NaN') return;
                
                const value = parseFloat(valueStr);
                if (isNaN(value)) return;
                
                const time = new Date(timeEl.textContent);
                
                if (!latestMeasurement || time > latestMeasurement.time) {
                    latestMeasurement = { value, time };
                }
            });
            
            if (latestMeasurement) {
                const current = locations.get(locationKey);
                if (!current || latestMeasurement.time > current.time) {
                    locations.set(locationKey, {
                        lat,
                        lng,
                        value: latestMeasurement.value,
                        time: latestMeasurement.time,
                        stationName
                    });
                }
            }
        } catch (error) {
            console.warn('Error parsing weather observation:', error);
        }
    });
    
    return Array.from(locations.values());
}

export async function fetchWindData() {
    const [speedData, dirData] = await Promise.all([
        fetchWeatherParameter('windspeedms'),
        fetchWeatherParameter('winddirection')
    ]);
    
    const windMap = new Map();
    const keyOf = (lat, lng) => `${lat.toFixed(4)}_${lng.toFixed(4)}`;
    
    speedData.forEach(s => {
        windMap.set(keyOf(s.lat, s.lng), {
            lat: s.lat,
            lng: s.lng,
            speed: s.value,
            time: s.time,
            stationName: s.stationName
        });
    });
    
    dirData.forEach(d => {
        const key = keyOf(d.lat, d.lng);
        const existing = windMap.get(key) || {
            lat: d.lat,
            lng: d.lng,
            stationName: d.stationName
        };
        existing.direction = d.value;
        if (!existing.time || d.time > existing.time) {
            existing.time = d.time;
        }
        windMap.set(key, existing);
    });
    
    return Array.from(windMap.values()).filter(e => 
        typeof e.speed === 'number' && typeof e.direction === 'number'
    );
}

export async function fetchAvailableRadarTimes() {
    try {
        const capabilitiesUrl = 'https://openwms.fmi.fi/geoserver/Radar/wms?service=WMS&version=1.1.1&request=GetCapabilities';
        const response = await fetchWithTimeout(capabilitiesUrl);
        const text = await response.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        const dimensions = xmlDoc.querySelectorAll('Dimension[name="time"], dimension[name="time"]');
        for (let dim of dimensions) {
            const timeContent = dim.textContent.trim();
            if (timeContent.includes('/')) {
                const parts = timeContent.split('/');
                if (parts.length >= 2) {
                    const endTime = new Date(parts[1]);
                    const times = [];
                    
                    for (let i = 0; i <= 12; i++) {
                        const time = new Date(endTime.getTime() - (i * 5 * 60 * 1000));
                        times.push(time);
                    }
                    state.availableRadarTimes = times;
                    return;
                }
            }
        }
        
        generateFallbackRadarTimes();
    } catch (error) {
        console.warn('Could not fetch radar capabilities:', error);
        generateFallbackRadarTimes();
    }
}

function generateFallbackRadarTimes() {
    const now = new Date();
    const roundedNow = new Date(now);
    roundedNow.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
    roundedNow.setSeconds(0);
    roundedNow.setMilliseconds(0);
    
    const times = [];
    for (let i = 0; i <= 12; i++) {
        const time = new Date(roundedNow.getTime() - (i * 5 * 60 * 1000));
        times.push(time);
    }
    state.availableRadarTimes = times;
}