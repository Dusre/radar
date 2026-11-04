import { state } from './state.js';
import { CONFIG } from './config.js';
import { updateRadarLayer, updateTimeDisplay } from './ui-updates.js';
import { getRadarTileUrls } from './layers.js';
import { stopAutoRefresh } from './main.js';

let map = null;

export function setMap(mapInstance) {
    map = mapInstance;
}

export async function preloadRadarImages() {
    state.preloadedImages.clear();

    // Warm the browser cache with the exact tile URLs the radar layer will
    // request for each frame. (No crossOrigin: the layer's own <img> tiles
    // don't use it, and a mismatch can make the browser skip the cache.)
    const promises = [];
    for (let step = 0; step <= CONFIG.MAX_HISTORY_STEPS; step++) {
        const urls = getRadarTileUrls(step);
        const images = [];
        state.preloadedImages.set(step, images); // keep references alive

        urls.forEach(url => {
            promises.push(
                new Promise((resolve) => {
                    const img = new Image();
                    img.onload = resolve;
                    img.onerror = () => {
                        console.warn(`Failed to preload radar tile for step ${step}`);
                        resolve();
                    };
                    img.src = url;
                    images.push(img);
                })
            );
        });
    }

    await Promise.all(promises);
}

export async function startAnimation() {
    if (state.isAnimating) return;

    stopAutoRefresh();
    state.isAnimating = true;
    state.animationCacheBust = Date.now();

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