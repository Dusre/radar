export const state = {
    lightningData: { type: "FeatureCollection", features: [] },
    newestStrikeTimestamp: null,
    radarLastUpdateTimestamp: null,
    nextRefreshTimestamp: null,
    currentHistoryStep: 0,
    isAnimating: false,
    animationInterval: null,
    preloadedImages: new Map(),
    refreshInterval: null,
    temperatureStationCount: 0,
    windStationCount: 0,
    cloudStationCount: 0,
    availableRadarTimes: []
};

export const layers = {
    wind: L.layerGroup(),
    humidity: L.layerGroup(),
    pressure: L.layerGroup(),
    temperature: L.layerGroup(),
    clouds: L.layerGroup(),
    lightning: null,
    fmiRadar: null,
    localMap: null
};