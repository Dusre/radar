import { state } from './state.js';
import { getRadarTimeForStep } from './layers.js';

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
    const time = getRadarTimeForStep(state.currentHistoryStep);
    timeDisplay.textContent = time
        ? time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
        : 'Nyt (Live)';
}