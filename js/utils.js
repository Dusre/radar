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
    // Return gradient colors for temperature ranges
    if (temp < -20) return 'linear-gradient(135deg, #001a4d, #003380)';
    if (temp < -10) return 'linear-gradient(135deg, #0040ff, #0066ff)';
    if (temp < 0) return 'linear-gradient(135deg, #00ccff, #00ffff)';
    if (temp < 10) return 'linear-gradient(135deg, #00cc00, #00ff00)';
    if (temp < 20) return 'linear-gradient(135deg, #ffcc00, #ffff00)';
    if (temp < 30) return 'linear-gradient(135deg, #ff8000, #ffaa00)';
    return 'linear-gradient(135deg, #ff0000, #ff3333)';
}

export function getColorForHumidity(rh) {
    // Water-inspired blue gradients
    if (rh < 30) {
        return 'linear-gradient(135deg, #FFE4B5 0%, #DEB887 100%)'; // Dry - sandy colors
    } else if (rh < 50) {
        return 'linear-gradient(135deg, #87CEEB 0%, #4682B4 100%)'; // Light blue
    } else if (rh < 70) {
        return 'linear-gradient(135deg, #4682B4 0%, #1E90FF 100%)'; // Medium blue
    } else if (rh < 85) {
        return 'linear-gradient(135deg, #1E90FF 0%, #0000CD 100%)'; // Deep blue
    } else {
        return 'linear-gradient(135deg, #0000CD 0%, #000080 100%)'; // Dark blue - very humid
    }
}

export function getColorForPressure(hpa) {
    // Return solid colors for pressure (used for the indicator bar)
    if (hpa < 990) return '#ff4444'; // Low pressure - red
    if (hpa < 1000) return '#ff8844'; // Orange
    if (hpa < 1013) return '#ffcc44'; // Yellow
    if (hpa < 1020) return '#44ff44'; // Green - normal
    return '#44ccff'; // High pressure - blue
}

// Add function to get pressure background based on value
export function getPressureBackground(hpa) {
    if (hpa < 990) {
        return 'linear-gradient(135deg, #3a1f1f 0%, #2a1515 100%)'; // Dark red tint
    } else if (hpa < 1000) {
        return 'linear-gradient(135deg, #3a2f1f 0%, #2a1f15 100%)'; // Dark orange tint
    } else if (hpa < 1013) {
        return 'linear-gradient(135deg, #2a2a1f 0%, #1f1f15 100%)'; // Dark yellow tint
    } else if (hpa < 1020) {
        return 'linear-gradient(135deg, #1f2a1f 0%, #151f15 100%)'; // Dark green tint
    } else {
        return 'linear-gradient(135deg, #1f1f2a 0%, #15151f 100%)'; // Dark blue tint
    }
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

// Add function to determine if temperature is extreme
export function getTemperatureExtreme(temp) {
    if (temp > 30) return 'hot';
    if (temp < -15) return 'cold';
    return null;
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