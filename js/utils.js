export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function formatTime(date) {
    return date.toLocaleTimeString('sv-SE', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });
}

export function getColorForTemperature(temp) {
    if (temp < -20) return '#000080';
    if (temp < -10) return '#0040ff';
    if (temp < 0) return '#00ffff';
    if (temp < 10) return '#00ff00';
    if (temp < 20) return '#ffff00';
    if (temp < 30) return '#ff8000';
    return '#ff0000';
}

export function getColorForHumidity(rh) {
    if (rh < 30) return '#ffcc00';
    if (rh < 60) return '#00ccff';
    if (rh < 80) return '#3399ff';
    return '#0044aa';
}

export function getColorForPressure(hpa) {
    if (hpa < 990) return '#ff3333';
    if (hpa < 1005) return '#ff9933';
    if (hpa < 1020) return '#33cc33';
    return '#3399ff';
}

export function getCloudIcon(coverage) {
    const percentage = (coverage / 8) * 100;
    
    if (percentage <= 25) {
        return { icon: '☀️', color: '#FFD700', description: 'Selkeä' };
    } else if (percentage <= 75) {
        return { icon: '⛅', color: '#87CEEB', description: 'Puolipilvinen' };
    } else {
        return { icon: '☁️', color: '#B0C4DE', description: 'Pilvinen' };
    }
}

export function degreesToCardinal(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return dirs[index];
}

export async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}