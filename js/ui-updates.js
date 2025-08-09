import { state } from './state.js';
import { CONFIG } from './config.js';

export function updateRadarAgeDisplay() {
    const element = document.getElementById('radar-age');
    if (state.radarLastUpdateTimestamp) {
        const seconds = Math.round((Date.now() - state.radarLastUpdateTimestamp) / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        element.textContent = `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s sitten`;
    } else {
        element.textContent = '--';
    }
}

export function updateLightningAgeDisplay() {
    const element = document.getElementById('data-age');
    if (state.newestStrikeTimestamp) {
        const seconds = Math.round((Date.now() - state.newestStrikeTimestamp) / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        element.textContent = `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s sitten`;
    } else {
        element.textContent = '--';
    }
}

export function updateCountdownDisplay() {
    const element = document.getElementById('next-update-countdown');
    if (state.nextRefreshTimestamp && !state.isAnimating) {
        const remainingMs = state.nextRefreshTimestamp - Date.now();
        if (remainingMs <= 0) {
            element.textContent = 'Päivitetään...';
        } else {
            const remainingSeconds = Math.round(remainingMs / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            element.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
    } else if (state.isAnimating) {
        element.textContent = 'Animaatio';
    } else {
        element.textContent = '--';
    }
}

export function updateTimeDisplay() {
    const timeDisplay = document.getElementById('time-display');
    if (state.currentHistoryStep === 0) {
        timeDisplay.textContent = 'Nyt (Live)';
    } else {
        const historicalTime = getHistoricalRadarTime();
        if (historicalTime) {
            timeDisplay.textContent = historicalTime.toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            const minutesAgo = state.currentHistoryStep * CONFIG.HISTORY_STEP_MINUTES;
            const fallbackTime = new Date(Date.now() - minutesAgo * 60 * 1000);
            timeDisplay.textContent = fallbackTime.toLocaleTimeString('sv-SE', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
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

export { updateRadarLayer } from './layers.js';