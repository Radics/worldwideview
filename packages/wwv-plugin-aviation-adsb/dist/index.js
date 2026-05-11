const f = "https://adsb.lol/api/0/aircraft.json";
function h(r) {
  return r == null || r <= 0 ? "#4ade80" : r < 3e3 ? "#22d3ee" : r < 8e3 ? "#3b82f6" : r < 12e3 ? "#a78bfa" : "#f472b6";
}
class p {
  constructor() {
    this.id = "wwv-plugin-aviation-adsb", this.name = "Aviation (ADSB.lol)", this.description = "Real-time civilian/commercial aircraft tracking via adsb.lol", this.icon = "✈", this.category = "aviation", this.version = "1.0.0", this.ctx = null;
  }
  async initialize(l) {
    this.ctx = l, console.log("[Aviation-ADSB] Initialized");
  }
  destroy() {
    this.ctx = null;
  }
  async fetch(l) {
    try {
      const i = await fetch(f);
      if (!i.ok) throw new Error(`HTTP ${i.status}`);
      const e = await i.json();
      return ((e == null ? void 0 : e.aircraft) ?? (e == null ? void 0 : e.ac) ?? []).map((t, g) => {
        var o, a, s, c, u, d;
        const n = t.alt_baro ?? t.alt_geom ?? t.alt ?? null;
        return {
          id: t.hex ?? `ac-${g}`,
          pluginId: this.id,
          latitude: t.lat,
          longitude: t.lon,
          altitude: n,
          heading: t.track ?? t.true_heading ?? t.mag_heading,
          speed: t.gs ?? t.ground_speed,
          timestamp: new Date(t.seen_pos ?? t.seen ?? Date.now()),
          label: ((o = t.flight) == null ? void 0 : o.trim()) || ((a = t.r) == null ? void 0 : a.trim()) || ((s = t.t) == null ? void 0 : s.trim()) || void 0,
          properties: {
            callsign: ((c = t.flight) == null ? void 0 : c.trim()) ?? "",
            registration: ((u = t.r) == null ? void 0 : u.trim()) ?? "",
            type: ((d = t.t) == null ? void 0 : d.trim()) ?? "",
            squawk: t.squawk ?? "",
            category: t.category ?? "",
            altitudeFt: n != null ? Math.round(n * 3.28084) : null
          }
        };
      });
    } catch (i) {
      return console.error("[Aviation-ADSB] Fetch failed:", i), [];
    }
  }
  getPollingInterval() {
    return 3e4;
  }
  getLayerConfig() {
    return {
      color: "#3b82f6",
      clusterEnabled: !0,
      clusterDistance: 40,
      minZoomLevel: 3,
      maxEntities: 1e4
    };
  }
  renderEntity(l) {
    var e;
    const i = h(l.altitude);
    return {
      type: "billboard",
      color: i,
      size: 12,
      iconUrl: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9 13,14 8,11 3,14 5,9 1,6 6,6" fill="${i}" stroke="white" stroke-width="1"/></svg>`
      ),
      outlineColor: "#ffffff",
      outlineWidth: 1,
      labelText: l.label ?? ((e = l.properties) == null ? void 0 : e.callsign) ?? "",
      labelFont: "12px sans-serif",
      distanceDisplayCondition: { near: 0, far: 1e7 },
      iconScale: 0.8,
      depthBias: -500
    };
  }
  getLegend() {
    return [
      { label: "0 m (Grounded)", color: "#4ade80" },
      { label: "< 3,000 m", color: "#22d3ee" },
      { label: "3,000 - 8,000 m", color: "#3b82f6" },
      { label: "8,000 - 12,000 m", color: "#a78bfa" },
      { label: "> 12,000 m", color: "#f472b6" }
    ];
  }
  getFilterDefinitions() {
    return [
      {
        id: "altitude",
        label: "Altitude (m)",
        type: "range",
        propertyKey: "altitude",
        range: { min: 0, max: 15e3, step: 100 }
      }
    ];
  }
}
export {
  p as AviationAdsbPlugin,
  p as default
};
