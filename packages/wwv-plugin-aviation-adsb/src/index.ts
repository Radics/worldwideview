import type {
  WorldPlugin,
  GeoEntity,
  PluginContext,
  TimeRange,
  LayerConfig,
  CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";

const ADSB_API_URL = "https://adsb.lol/api/0/aircraft.json";

function altitudeToColor(altitudeMeters: number | null | undefined): string {
  if (altitudeMeters == null || altitudeMeters <= 0) return "#4ade80";   // green – grounded
  if (altitudeMeters < 3000) return "#22d3ee";                            // cyan – low
  if (altitudeMeters < 8000) return "#3b82f6";                            // blue – mid
  if (altitudeMeters < 12000) return "#a78bfa";                           // purple – high
  return "#f472b6";                                                       // pink – very high
}

export class AviationAdsbPlugin implements WorldPlugin {
  id = "wwv-plugin-aviation-adsb";
  name = "Aviation (ADSB.lol)";
  description = "Real-time civilian/commercial aircraft tracking via adsb.lol";
  icon = "✈";
  category = "aviation" as const;
  version = "1.0.0";

  private ctx: PluginContext | null = null;

  async initialize(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    console.log("[Aviation-ADSB] Initialized");
  }

  destroy(): void {
    this.ctx = null;
  }

  async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
    try {
      const resp = await fetch(ADSB_API_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const aircraft: any[] = data?.aircraft ?? data?.ac ?? [];
      return aircraft.map((a: any, idx: number) => {
        const altMeters = a.alt_baro ?? a.alt_geom ?? a.alt ?? null;
        return {
          id: a.hex ?? `ac-${idx}`,
          pluginId: this.id,
          latitude: a.lat,
          longitude: a.lon,
          altitude: altMeters,
          heading: a.track ?? a.true_heading ?? a.mag_heading,
          speed: a.gs ?? a.ground_speed,
          timestamp: new Date(a.seen_pos ?? a.seen ?? Date.now()),
          label: a.flight?.trim() || a.r?.trim() || a.t?.trim() || undefined,
          properties: {
            callsign: a.flight?.trim() ?? "",
            registration: a.r?.trim() ?? "",
            type: a.t?.trim() ?? "",
            squawk: a.squawk ?? "",
            category: a.category ?? "",
            altitudeFt: altMeters != null ? Math.round(altMeters * 3.28084) : null,
          },
        };
      });
    } catch (err) {
      console.error("[Aviation-ADSB] Fetch failed:", err);
      return [];
    }
  }

  getPollingInterval(): number {
    return 30_000; // 30 seconds
  }

  getLayerConfig(): LayerConfig {
    return {
      color: "#3b82f6",
      clusterEnabled: true,
      clusterDistance: 40,
      minZoomLevel: 3,
      maxEntities: 10000,
    };
  }

  renderEntity(entity: GeoEntity): CesiumEntityOptions {
    const color = altitudeToColor(entity.altitude);
    return {
      type: "billboard",
      color,
      size: 12,
      iconUrl:
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9 13,14 8,11 3,14 5,9 1,6 6,6" fill="${color}" stroke="white" stroke-width="1"/></svg>`
        ),
      outlineColor: "#ffffff",
      outlineWidth: 1,
      labelText: entity.label ?? (entity.properties?.callsign as string) ?? "",
      labelFont: "12px sans-serif",
      distanceDisplayCondition: { near: 0, far: 10000000 },
      iconScale: 0.8,
      depthBias: -500,
    };
  }

  getLegend(): { label: string; color: string }[] {
    return [
      { label: "0 m (Grounded)", color: "#4ade80" },
      { label: "< 3,000 m", color: "#22d3ee" },
      { label: "3,000 - 8,000 m", color: "#3b82f6" },
      { label: "8,000 - 12,000 m", color: "#a78bfa" },
      { label: "> 12,000 m", color: "#f472b6" },
    ];
  }

  getFilterDefinitions() {
    return [
      {
        id: "altitude",
        label: "Altitude (m)",
        type: "range" as const,
        propertyKey: "altitude",
        range: { min: 0, max: 15000, step: 100 },
      },
    ];
  }
}

export default AviationAdsbPlugin;
