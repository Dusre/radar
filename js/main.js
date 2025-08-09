import { CONFIG } from './config.js';
import { state, layers } from './state.js';
import { initializeMap } from './map.js';
import { 
    setMap as setLayersMap,
    updateLightning, 
    updateTemperatureLayer, 
    updateWindLayer, 
    updateCloudLayer, 
    updateHumidityLayer, 
    updatePressureLayer,
    updateRadarLayer 
} from './layers.js';
import { 
    setMap as setAnimationsMap,
    startAnimation, 
    stopAnimation, 
    updateHistorySlider 
} from './animations.js';
import { 
    updateRadarAgeDisplay, 
    updateLightningAgeDisplay, 
    updateCountdownDisplay,
    updateTimeDisplay 
} from './ui-updates.js';
import { fetchLightningData, fetchAvailableRadarTimes } from './data-fetchers.js';

// Check that required libraries are loaded
if (typeof L === 'undefined') {
    console.error('Leaflet library failed to load');
    document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Failed to load required libraries. Please refresh the page.</div>';
} else if (typeof proj4 === 'undefined') {
    console.error('Proj4 library failed to load');
    document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Failed to load required libraries. Please refresh the page.</div>';
} else {
    initialize();
}

async function refreshAll() {
    if (state.isAnimating) return;
    
    const now = Date.now();
    state.radarLastUpdateTimestamp = now;
    
    try {
        await Promise.all([
            fetchLightningData(),
            updateTemperatureLayer(),
            updateWindLayer(),
            updateCloudLayer(),
            updateHumidityLayer(),
            updatePressureLayer()
        ]);
        
        updateLightning();
        updateRadarLayer();
        state.nextRefreshTimestamp = Date.now() + CONFIG.REFRESH_INTERVAL_MS;
    } catch (error) {
        console.error('Error in refreshAll:', error);
    }
}

function startAutoRefresh() {
    if (state.refreshInterval) return;
    
    state.refreshInterval = setInterval(refreshAll, CONFIG.REFRESH_INTERVAL_MS);
    state.nextRefreshTimestamp = Date.now() + CONFIG.REFRESH_INTERVAL_MS;
}

export function stopAutoRefresh() {
    if (state.refreshInterval) {
        clearInterval(state.refreshInterval);
        state.refreshInterval = null;
        state.nextRefreshTimestamp = null;
    }
}

function loadSettings() {
    const settings = {
        showLightning: localStorage.getItem('showLightning') === 'true',
        showTemperature: localStorage.getItem('showTemperature') === 'true',
        showWind: localStorage.getItem('showWind') === 'true',
        showClouds: localStorage.getItem('showClouds') === 'true',
        showHumidity: localStorage.getItem('showHumidity') === 'true',
        showPressure: localStorage.getItem('showPressure') === 'true',
        radarOpacity: parseFloat(localStorage.getItem('radarOpacity')) || 0.7
    };
    
    document.getElementById('lightning-toggle').checked = settings.showLightning;
    document.getElementById('temperature-toggle').checked = settings.showTemperature;
    document.getElementById('wind-toggle').checked = settings.showWind;
    document.getElementById('clouds-toggle').checked = settings.showClouds;
    document.getElementById('humidity-toggle').checked = settings.showHumidity;
    document.getElementById('pressure-toggle').checked = settings.showPressure;
    document.getElementById('opacity-slider').value = settings.radarOpacity;
    document.getElementById('opacity-value').textContent = Math.round(settings.radarOpacity * 100) + '%';
    
    layers.fmiRadar.setOpacity(settings.radarOpacity);
    
    // Ensure only one layer is active
    const activeToggles = [
        'lightning-toggle',
        'temperature-toggle',
        'wind-toggle',
        'clouds-toggle',
        'humidity-toggle',
        'pressure-toggle'
    ].filter(id => document.getElementById(id).checked);
    
    if (activeToggles.length > 1) {
        activeToggles.slice(1).forEach(id => {
            document.getElementById(id).checked = false;
            const storageKey = id.replace('-toggle', '')
                .replace('lightning', 'showLightning')
                .replace('temperature', 'showTemperature')
                .replace('wind', 'showWind')
                .replace('clouds', 'showClouds')
                .replace('humidity', 'showHumidity')
                .replace('pressure', 'showPressure');
            localStorage.setItem(storageKey, 'false');
        });
    }
}

function setupEventListeners() {
    // Toggle configurations
    const toggleConfigs = [
        { id: 'lightning-toggle', key: 'showLightning', update: updateLightning },
        { id: 'temperature-toggle', key: 'showTemperature', update: updateTemperatureLayer },
        { id: 'wind-toggle', key: 'showWind', update: updateWindLayer },
        { id: 'clouds-toggle', key: 'showClouds', update: updateCloudLayer },
        { id: 'humidity-toggle', key: 'showHumidity', update: updateHumidityLayer },
        { id: 'pressure-toggle', key: 'showPressure', update: updatePressureLayer }
    ];
    
    function setExclusive(activeId) {
        toggleConfigs.forEach(config => {
            const element = document.getElementById(config.id);
            if (config.id === activeId) {
                element.checked = true;
                localStorage.setItem(config.key, 'true');
            } else {
                element.checked = false;
                localStorage.setItem(config.key, 'false');
            }
            config.update();
        });
    }
    
    toggleConfigs.forEach(config => {
        document.getElementById(config.id).addEventListener('change', (e) => {
            if (e.target.checked) {
                setExclusive(config.id);
            } else {
                localStorage.setItem(config.key, 'false');
                config.update();
            }
        });
    });
    
    // Opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    
    opacitySlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        layers.fmiRadar.setOpacity(value);
        localStorage.setItem('radarOpacity', value);
        opacityValue.textContent = Math.round(value * 100) + '%';
    });
    
    // History slider
    document.getElementById('history-slider').addEventListener('input', (e) => {
        if (state.isAnimating) stopAnimation();
        
        const newStep = parseInt(e.target.value);
        state.currentHistoryStep = newStep;
        
        if (state.currentHistoryStep === 0) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
        
        updateRadarLayer();
        updateTimeDisplay();
    });
    
    // Animation button
    document.getElementById('animation-button').addEventListener('click', (e) => {
        e.preventDefault();
        if (state.isAnimating) {
            stopAnimation();
            startAutoRefresh();
            setTimeout(refreshAll, 100);
        } else {
            startAnimation();
        }
    });
    
    // Manual refresh button
    document.getElementById('refresh-btn').addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Päivitetään...';
        
        if (state.isAnimating) {
            stopAnimation();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        state.currentHistoryStep = 0;
        document.getElementById('history-slider').value = 0;
        updateTimeDisplay();
        
        await refreshAll();
        startAutoRefresh();
        
        button.disabled = false;
        button.innerHTML = '<span class="button-icon">⟳</span><span>Päivitä</span>';
    });
    
    // Toggle controls panel
    const controlsPanel = document.querySelector('.controls');
    const toggleBtn = document.getElementById('toggle-controls-btn');
    
    toggleBtn.addEventListener('click', () => {
        controlsPanel.classList.toggle('hidden');
        if (controlsPanel.classList.contains('hidden')) {
            toggleBtn.innerHTML = '☰';
            toggleBtn.title = 'Näytä säädöt';
            toggleBtn.setAttribute('aria-label', 'Näytä säädöt');
        } else {
            toggleBtn.innerHTML = '×';
            toggleBtn.title = 'Piilota säädöt';
            toggleBtn.setAttribute('aria-label', 'Piilota säädöt');
        }
    });
}

async function initialize() {
    console.log('Initializing weather radar application...');
    
    // Initialize map
    const map = initializeMap();
    setLayersMap(map);
    setAnimationsMap(map);
    
    // Load saved settings
    loadSettings();
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch initial data
    await fetchAvailableRadarTimes();
    await refreshAll();
    
    // Update layers based on settings
    await Promise.all([
        updateTemperatureLayer(),
        updateWindLayer(),
        updateCloudLayer(),
        updateHumidityLayer(),
        updatePressureLayer()
    ]);
    
    updateTimeDisplay();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Setup periodic updates
    setInterval(updateRadarAgeDisplay, 1000);
    setInterval(updateLightningAgeDisplay, 1000);
    setInterval(updateCountdownDisplay, 1000);
    setInterval(fetchAvailableRadarTimes, 10 * 60 * 1000);
    
    console.log('Initialization complete');
}