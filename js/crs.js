import { Point, LatLng, Bounds } from 'leaflet';

/**
 * Standalone CRS for Leaflet 2 backed by proj4 (replaces Proj4Leaflet's
 * L.Proj.CRS, which depended on the removed L.Class.extend). It implements
 * the CRS interface Leaflet calls on `map.options.crs` directly, so it does
 * not depend on the internals of Leaflet's own CRS class.
 */
export class ProjCRS {
    constructor(code, def, { resolutions, origin = [0, 0], bounds = null } = {}) {
        this.code = code;
        this.infinite = !bounds;
        this.wrapLng = undefined;
        this.wrapLat = undefined;
        this._proj = proj4(def);
        this._scales = resolutions.map(r => 1 / r);

        // x' = scale * (x - originX),  y' = scale * (originY - y)
        const [ox, oy] = origin;
        this.transformation = {
            transform: (p, s = 1) => new Point(s * (p.x - ox), s * (oy - p.y)),
            untransform: (p, s = 1) => new Point(p.x / s + ox, oy - p.y / s)
        };

        this.projection = {
            bounds,
            project: ll => {
                const p = this._proj.forward([ll.lng, ll.lat]);
                return new Point(p[0], p[1]);
            },
            unproject: (pt, unbounded) => {
                const ll = this._proj.inverse([pt.x, pt.y]);
                return new LatLng(ll[1], ll[0], unbounded);
            }
        };
    }

    project(latlng) { return this.projection.project(latlng); }
    unproject(point, unbounded) { return this.projection.unproject(point, unbounded); }

    latLngToPoint(latlng, zoom) {
        return this.transformation.transform(this.project(latlng), this.scale(zoom));
    }

    pointToLatLng(point, zoom) {
        return this.unproject(this.transformation.untransform(point, this.scale(zoom)));
    }

    scale(zoom) {
        const i = Math.floor(zoom);
        if (zoom === i) return this._scales[zoom];
        const s1 = this._scales[i], s2 = this._scales[i + 1];
        if (s1 === undefined || s2 === undefined) return NaN;
        return s1 + (s2 - s1) * (zoom - i);
    }

    zoom(scale) {
        const s = this._scales;
        if (scale <= s[0]) return 0;
        let i = 0;
        while (i < s.length - 1 && s[i + 1] <= scale) i++;
        if (i >= s.length - 1) return s.length - 1;
        return i + (scale - s[i]) / (s[i + 1] - s[i]);
    }

    getProjectedBounds(zoom) {
        if (this.infinite) return null;
        const b = this.projection.bounds, s = this.scale(zoom);
        return new Bounds(this.transformation.transform(b.min, s), this.transformation.transform(b.max, s));
    }

    getSize(zoom) {
        const b = this.projection.bounds;
        const s = this.scale(zoom);
        if (!b) return new Point(s, s);
        return new Point(Math.abs(b.max.x - b.min.x) * s, Math.abs(b.max.y - b.min.y) * s);
    }

    wrapLatLng(latlng) { return latlng; }
    wrapLatLngBounds(bounds) { return bounds; }

    distance(a, b) { // haversine, metres
        const R = 6371008.8, rad = Math.PI / 180;
        const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
        const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    }
}