import { state } from './state.js';
import { CONFIG } from './config.js';
import { updateRadarLayer, updateTimeDisplay } from './ui-updates.js';
import { stopAutoRefresh } from './main.js';

let map = null;

export function setMap(mapInstance) {
    map = mapInstance;
}

export async function preloadRadarImages() {
    const bounds = map.getBounds();
    const size = map.getSize();

    const promises = [];
    for (let step = 0; step <= CONFIG.MAX_HISTORY_STEPS; step++) {
        const timeKey = step === 0 ? 'live' : state.availableRadarTimes[step]?.toISOString();
        if (!timeKey || state.preloadedImages.has(timeKey)) continue;

        const params = new URLSearchParams({
            service: 'WMS',
            version: '1.1.1',
            request: 'GetMap',
            layers: 'Radar:suomi_dbz_eureffin',
            format: 'image/png',
            transparent: 'true',
            width: size.x,
            height: size.y,
            srs: 'EPSG:3067',
            bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
        });

        if (step > 0 && state.availableRadarTimes[step]) {
            params.set('time', state.availableRadarTimes[step].toISOString());
        }

        const url = `https://openwms.fmi.fi/geoserver/Radar/wms?${params.toString()}`;

        promises.push(
            new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    state.preloadedImages.set(timeKey, img);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to preload radar image for step ${step}`);
                    resolve();
                };
                img.src = url;
            })
        );
    }

    await Promise.all(promises);
}

export async function startAnimation() {
    if (state.isAnimating) return;

    stopAutoRefresh();
    state.isAnimating = true;

    const button = document.getElementById('animation-button');
    button.innerHTML = '<span class="button-icon">⏸</span><span>Pysäytä</span>';
    button.classList.remove('button-primary');
    button.classList.add('button-danger');

    const status = document.getElementById('status');
    status.textContent = 'Esiladataan animaatiota...';
    status.className = 'status loading';

    await preloadRadarImages();

    status.textContent = 'Animaatio käynnissä';
    status.className = 'status success';

    state.currentHistoryStep = CONFIG.MAX_HISTORY_STEPS;
    updateHistorySlider();

    state.animationInterval = setInterval(() => {
        state.currentHistoryStep--;

        if (state.currentHistoryStep < 0) {
            state.currentHistoryStep = CONFIG.MAX_HISTORY_STEPS;
        }

        updateHistorySlider();
    }, CONFIG.ANIMATION_INTERVAL_MS);
}

export function stopAnimation() {
    if (!state.isAnimating) return;

    state.isAnimating = false;
    const button = document.getElementById('animation-button');
    button.innerHTML = '<span class="button-icon">▶</span><span>Animaatio</span>';
    button.classList.remove('button-danger');
    button.classList.add('button-primary');

    if (state.animationInterval) {
        clearInterval(state.animationInterval);
        state.animationInterval = null;
    }

    state.currentHistoryStep = 0;
    updateHistorySlider();
}

export function updateHistorySlider() {
    const slider = document.getElementById('history-slider');
    slider.value = CONFIG.MAX_HISTORY_STEPS - state.currentHistoryStep;
    updateRadarLayer();
    updateTimeDisplay();
}