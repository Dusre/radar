import { Popup } from 'leaflet';
import { fetchPointForecast } from './data-fetchers.js';
import { getCloudIcon, getWindArrowColor } from './utils.js';
import { CONFIG } from './config.js';
import { isMeasurementActive, toggleMeasurement } from './measurement.js';

let map = null;
let active = false;
let popup = null;
let requestToken = 0;

export function setMap(mapInstance) {
    map = mapInstance;
}

const hhmm = d => d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' });
const escapeHtml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildChart(precip) {
    const w = 280, h = 64, labelH = 14;
    const n = precip.length;
    const barW = w / n;
    const max = Math.max(1, ...precip.map(p => p.value));

    const bars = precip.map((p, i) => {
        const bh = Math.max(p.value > 0 ? 1.5 : 0, (p.value / max) * h);
        return `<rect x="${(i * barW + 1).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(barW - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="1" fill="#4db8ff"><title>${hhmm(p.time)}: ${p.value.toFixed(1)} mm</title></rect>`;
    }).join('');

    const labels = precip.map((p, i) => i % 6 === 0
        ? `<text x="${(i * barW).toFixed(1)}" y="${h + 11}" font-size="10" fill="#aaa">${hhmm(p.time)}</text>`
        : ''
    ).join('');

    return `<svg width="${w}" height="${h + labelH}" viewBox="0 0 ${w} ${h + labelH}" role="img" aria-label="Sadeennuste tunneittain">
        <line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="#666" stroke-width="1"/>${bars}${labels}</svg>
        <div style="font-size:11px;color:#aaa;">Asteikko 0–${max.toFixed(1)} mm/h</div>`;
}

function buildTempChart(temps) {
    const w = 280, h = 56, pad = 14, labelH = 14;
    const n = temps.length;
    const vals = temps.map(p => p.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (max - min < 4) { const mid = (max + min) / 2; min = mid - 2; max = mid + 2; }
    const range = max - min;

    const x = i => n === 1 ? w / 2 : (i / (n - 1)) * (w - 2 * 4) + 4;
    const y = v => pad + (1 - (v - min) / range) * (h - 2 * pad);

    const line = temps.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${x(0).toFixed(1)},${h} ${line} ${x(n - 1).toFixed(1)},${h}`;

    const zero = min < 0 && max > 0
        ? `<line x1="0" y1="${y(0).toFixed(1)}" x2="${w}" y2="${y(0).toFixed(1)}" stroke="#888" stroke-width="1" stroke-dasharray="3 3"/>
           <text x="2" y="${(y(0) - 2).toFixed(1)}" font-size="9" fill="#888">0°</text>`
        : '';

    // Mark and label the extremes
    const iMax = vals.indexOf(Math.max(...vals)), iMin = vals.indexOf(Math.min(...vals));
    const mark = (i, dy) => `<circle cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="2.5" fill="#ffb347"/>
        <text x="${Math.min(Math.max(x(i), 10), w - 10).toFixed(1)}" y="${(y(vals[i]) + dy).toFixed(1)}" font-size="10" fill="#ddd" text-anchor="middle">${vals[i].toFixed(0)}°</text>`;

    const labels = temps.map((p, i) => i % 6 === 0
        ? `<text x="${x(i).toFixed(1)}" y="${h + 11}" font-size="10" fill="#aaa">${hhmm(p.time)}</text>`
        : '').join('');

    const hover = temps.map((p, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="5" fill="transparent"><title>${hhmm(p.time)}: ${p.value.toFixed(1)} °C</title></circle>`
    ).join('');

    return `<svg width="${w}" height="${h + labelH}" viewBox="0 0 ${w} ${h + labelH}" role="img" aria-label="Lämpötilaennuste tunneittain">
        ${zero}
        <polygon points="${area}" fill="#ffb347" fill-opacity="0.15"/>
        <polyline points="${line}" fill="none" stroke="#ffb347" stroke-width="2" stroke-linejoin="round"/>
        ${mark(iMax, iMax === iMin ? -6 : -6)}${iMin !== iMax ? mark(iMin, 13) : ''}
        ${hover}${labels}</svg>`;
}

const symbolUrl = code => `${CONFIG.SYMBOL_BASE_URL}${code}${CONFIG.SYMBOL_EXT}`;

// Rough solar elevation check (NOAA approximation) to pick the night variant of a symbol
function isNight(date, lat, lng) {
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);
    const g = (2 * Math.PI / 365) * (dayOfYear - 1 + (date.getUTCHours() - 12) / 24);
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
        - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g);
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
        - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    const hourAngle = ((minutes + eqTime + 4 * lng) / 4 - 180) * rad;
    const sinElev = Math.sin(lat * rad) * Math.sin(decl) +
        Math.cos(lat * rad) * Math.cos(decl) * Math.cos(hourAngle);
    return Math.asin(sinElev) / rad < -0.833;
}

// Hourly weather symbols (FMI SmartSymbol) in a horizontally scrollable strip.
// Falls back to a cloud-cover emoji for hours without a symbol code or image.
function buildSymbolStrip(latlng, symbols, clouds, temps, winds, dirs) {
    const byTime = arr => new Map(arr.map(p => [p.time.getTime(), p.value]));
    const symMap = byTime(symbols), cloudMap = byTime(clouds), tempMap = byTime(temps);
    const windMap = byTime(winds), dirMap = byTime(dirs);
    const times = (symbols.length ? symbols : clouds).map(p => p.time);

    const cells = times.map(time => {
        const t = time.getTime();
        const cloudPct = cloudMap.has(t) ? Math.max(0, Math.min(100, cloudMap.get(t))) : null;
        const cloudInfo = cloudPct !== null ? getCloudIcon(cloudPct / 12.5) : null;
        const emoji = cloudInfo ? cloudInfo.icon : '';
        const tip = [hhmm(time)];
        if (tempMap.has(t)) tip.push(`${tempMap.get(t).toFixed(1)} °C`);
        if (windMap.has(t)) tip.push(`tuuli ${windMap.get(t).toFixed(1)} m/s${dirMap.has(t) ? ' (' + Math.round(dirMap.get(t)) + '°)' : ''}`);
        if (cloudPct !== null) tip.push(`pilvisyys ${Math.round(cloudPct)} %`);

        let windHtml = '';
        if (windMap.has(t)) {
            const speed = windMap.get(t);
            const arrow = dirMap.has(t)
                ? `<div style="display:inline-block;font-size:12px;line-height:1;color:${getWindArrowColor(speed)};transform:rotate(${(dirMap.get(t) + 180) % 360}deg);">↑</div>`
                : '';
            windHtml = `<div style="height:14px;">${arrow}</div><div style="font-size:11px;">${speed.toFixed(1)}</div>`;
        }

        let icon;
        if (symMap.has(t) && Number.isFinite(symMap.get(t))) {
            const day = Math.round(symMap.get(t));
            const night = isNight(time, latlng.lat, latlng.lng);
            const code = night ? day + 100 : day;
            icon = `<img class="smartsymbol" src="${symbolUrl(code)}" width="30" height="30" alt="Sääsymboli ${day}"
                data-day="${day}" data-night="${night ? 1 : 0}" data-emoji="${emoji}" style="display:block;margin:0 auto;">`;
        } else {
            icon = `<div style="font-size:20px;height:30px;line-height:30px;">${emoji}</div>`;
        }

        return `<div title="${tip.join(' · ')}" style="flex:0 0 36px;text-align:center;line-height:1.25;">
            <div style="font-size:10px;color:#aaa;">${hhmm(time).slice(0, 2)}</div>
            ${icon}
            <div style="font-size:11px;">${tempMap.has(t) ? Math.round(tempMap.get(t)) + '°' : ''}</div>
            ${windHtml}
        </div>`;
    }).join('');

    return `<div style="display:flex;overflow-x:auto;width:280px;padding-bottom:4px;" aria-label="Sää tunneittain">${cells}</div>`;
}

// Missing night image -> try the day image -> fall back to the cloud emoji
function wireSymbolFallbacks(root) {
    if (!root) return;
    root.querySelectorAll('img.smartsymbol').forEach(img => {
        img.addEventListener('error', () => {
            if (img.dataset.night === '1' && img.dataset.stage !== 'day') {
                img.dataset.stage = 'day';
                img.src = symbolUrl(img.dataset.day);
                return;
            }
            const span = document.createElement('div');
            span.style.cssText = 'font-size:20px;height:30px;line-height:30px;';
            span.textContent = img.dataset.emoji || '';
            img.replaceWith(span);
        });
    });
}

const sectionTitle = t => `<div style="margin:10px 0 2px;font-size:12px;color:#aaa;">${t}</div>`;

function buildContent(latlng, series, place) {
    const where = place ? escapeHtml(place) : `${latlng.lat.toFixed(3)}, ${latlng.lng.toFixed(3)}`;
    const header = `<strong>🔮 Sääennuste</strong><br><span style="font-size:12px;color:#aaa;">📌 ${where}</span>`;
    const precip = series.Precipitation1h || [];
    const temps = series.Temperature || [];
    const clouds = series.TotalCloudCover || [];
    const symbols = series.SmartSymbol || [];
    const winds = series.WindSpeedMS || [];
    const dirs = series.WindDirection || [];

    if (!precip.length && !temps.length && !clouds.length && !symbols.length && !winds.length) {
        return `${header}<div style="margin-top:8px;">Ennustetta ei saatu tälle sijainnille.</div>`;
    }

    let html = header;
    if (symbols.length || clouds.length) html += sectionTitle('🌤️ Sää tunneittain (°C, m/s)') + buildSymbolStrip(latlng, symbols, clouds, temps, winds, dirs);
    if (precip.length) html += sectionTitle('🌧️ Sade (mm/h)') + buildChart(precip);
    if (temps.length) html += sectionTitle('🌡️ Lämpötila (°C)') + buildTempChart(temps);
    return html;
}

async function handleMapClick(e) {
    if (!active || isMeasurementActive()) return;

    const token = ++requestToken;
    popup = new Popup({ className: 'dark-popup', maxWidth: 320, minWidth: 280 })
        .setLatLng(e.latlng)
        .setContent('<strong>🔮 Sääennuste</strong><br>Ladataan ennustetta...')
        .openOn(map);
    const thisPopup = popup;

    try {
        const { series, place } = await fetchPointForecast(e.latlng.lat, e.latlng.lng);
        if (token !== requestToken) return; // a newer click superseded this one
        thisPopup.setContent(buildContent(e.latlng, series, place));
        wireSymbolFallbacks(thisPopup.getElement ? thisPopup.getElement() : null);
    } catch (error) {
        console.error('Forecast error:', error);
        if (token !== requestToken) return;
        thisPopup.setContent(`<strong>🔮 Sääennuste</strong><br>Virhe: ${error.message}`);
    }
}

function setActive(on) {
    if (on === active) return;
    active = on;

    const button = document.getElementById('forecast-btn');
    const info = document.getElementById('forecast-info');
    button.classList.toggle('active', active);
    info.classList.toggle('hidden', !active);

    if (active) {
        if (isMeasurementActive()) toggleMeasurement();
        map.getContainer().style.cursor = 'crosshair';
        map.on('click', handleMapClick);
    } else {
        map.getContainer().style.cursor = '';
        map.off('click', handleMapClick);
        requestToken++;
        if (popup) popup.close();
    }
}

export function initializeForecast() {
    const button = document.getElementById('forecast-btn');
    if (!button) {
        console.error('Forecast button not found');
        return;
    }

    button.addEventListener('click', () => setActive(!active));

    // Starting a measurement switches the forecast tool off
    const measureBtn = document.getElementById('measure-btn');
    if (measureBtn) {
        const off = () => { if (active && !isMeasurementActive()) setActive(false); };
        // measurement.js toggles on its own click/touchend handler; check right after it runs
        measureBtn.addEventListener('click', () => setTimeout(off, 0));
        measureBtn.addEventListener('touchend', () => setTimeout(off, 0));
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && active) setActive(false);
    });
}