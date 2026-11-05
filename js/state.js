import { LayerGroup } from 'leaflet';

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
    wind: new LayerGroup(),
    humidity: new LayerGroup(),
    pressure: new LayerGroup(),
    temperature: new LayerGroup(),
    clouds: new LayerGroup(),
    lightning: null,
    fmiRadar: null,
    localMap: null
};