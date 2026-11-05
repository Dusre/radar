export const state = {
    lightningData: { type: "FeatureCollection", features: [] },
    nextRefreshTimestamp: null,
    currentHistoryStep: 0,
    isAnimating: false,
    animationInterval: null,
    animationCacheBust: null,
    preloadedImages: new Map(),
    refreshInterval: null,
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