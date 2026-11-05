export const CONFIG = {
    MAX_STRIKE_AGE_MINUTES: 15,
    REFRESH_INTERVAL_MS: 2 * 60 * 1000,
    HISTORY_STEP_MINUTES: 5,
    MAX_HISTORY_STEPS: 12,
    ANIMATION_INTERVAL_MS: 1000,
    // FMI SmartSymbol icons (https://github.com/fmidev/opendata-resources/tree/master/symbols/SmartSymbol).
    // Copy that folder into your project and point this at it; files are expected to be
    // named <WeatherSymbol3 code>.svg (night variants: code + 100).
    SYMBOL_BASE_URL: 'symbols/',
    SYMBOL_EXT: '.svg',
    TIME_FORMAT_OPTIONS: { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    }
};