# adsb.lol Civilian Aviation Plugin — Implementation Plan

> **For Hermes:** Execute task-by-task. Fresh subagent per task.

**Goal:** Create a WorldWideView plugin that fetches civilian/commercial aircraft from adsb.lol API (since OpenSky is unreachable from all our networks), renders them on the 3D Cesium globe with altitude-based coloring.

**Architecture:** Standard `WorldPlugin` implementing the SDK interface. Fetches from adsb.lol API every 30s, maps response to `GeoEntity[]`, renders as altitude-colored billboards with callsign labels.

**Tech Stack:** TypeScript, @worldwideview/wwv-plugin-sdk, Vite

---

### Task 1: Create plugin scaffold

**Objective:** Set up the plugin package skeleton

**Files to create:**
- `/opt/data/worldwideview/packages/wwv-plugin-aviation-adsb/package.json`
- `/opt/data/worldwideview/packages/wwv-plugin-aviation-adsb/vite.config.ts`
- `/opt/data/worldwideview/packages/wwv-plugin-aviation-adsb/tsconfig.json`
- `/opt/data/worldwideview/packages/wwv-plugin-aviation-adsb/plugin.json`

**package.json:**
```json
{
  "name": "@worldwideview/wwv-plugin-aviation-adsb",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "dependencies": {
    "@worldwideview/wwv-plugin-sdk": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.4.1",
    "typescript": "^5.4.0"
  }
}
```

**vite.config.ts:**
```typescript
import { defineConfig } from "vite";
import { wwvPluginGlobals } from "@worldwideview/wwv-plugin-sdk/viteGlobals";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "cesium",
        "resium",
        "zustand",
        "@worldwideview/wwv-plugin-sdk",
        "@/core/state/store",
        "@/core/plugins/PluginManager",
      ],
    },
  },
  plugins: [wwvPluginGlobals()],
});
```

**tsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**plugin.json:**
```json
{
  "id": "wwv-plugin-aviation-adsb",
  "name": "Aviation (ADSB.lol)",
  "version": "1.0.0",
  "description": "Real-time civilian/commercial aircraft tracking via adsb.lol",
  "type": "data-layer",
  "format": "bundle",
  "trust": "unverified",
  "capabilities": ["data:own", "network:fetch", "ui:detail-panel"],
  "category": "aviation",
  "icon": "✈",
  "entry": "dist/index.js",
  "compatibility": { "worldwideview": ">=1.0.0" }
}
```

**Verify:** `ls /opt/data/worldwideview/packages/wwv-plugin-aviation-adsb/` should show all 4 files.

---

### Task 2: Implement the aviation plugin

**Objective:** Write the full `WorldPlugin` implementation that fetches from adsb.lol

**Create:** `/opt/data/worldwideview/packages/wwv-plugin-aviation-adsb/src/index.ts`

```typescript
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

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ctx: PluginContext | null = null;

  async initialize(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    console.log("[Aviation-ADSB] Initialized");
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
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
      labelText: entity.label ?? entity.properties?.callsign as string ?? "",
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
```

**Verify:** Read `src/index.ts` to confirm the file is complete and has no syntax issues.

---

### Task 3: Build the plugin

**Objective:** Compile the plugin and verify it produces valid output

**Commands:**
```bash
cd /opt/data/worldwideview
pnpm install --no-frozen-lockfile 2>&1 | tail -5
cd packages/wwv-plugin-aviation-adsb
pnpm run build 2>&1
```

**Expected output:** A `dist/index.js` file is created. No build errors.

**Verify:** `ls -la dist/index.js && head -3 dist/index.js`

---

### Task 4: Graphify update

**Objective:** Update the knowledge graph after all changes

**Command:**
```bash
cd /opt/data/worldwideview && graphify update . --force 2>&1
cd /opt/data/toolbox && graphify update . --force 2>&1
```

---

### Task 5: Journal entry

**Objective:** Append today's work to the journal

**Append to:** `/opt/data/toolbox/JOURNAL.md`

```markdown

---

## 2026-05-11 — adsb.lol Aviation Plugin Created

### What we built
- Created new WorldWideView plugin: `@worldwideview/wwv-plugin-aviation-adsb`
- Located at: `/opt/data/worldwideview/packages/wwv-plugin-aviation-adsb/`
- Fetches civilian/commercial aircraft from adsb.lol API every 30s
- Renders as altitude-colored billboards (green=grounded to pink=>12km)
- Implements the full WorldPlugin interface with legend, filters, detail panel support
- Works from all networks (unlike OpenSky which is unreachable from Contabo/Pi)

### Files created
- package.json — workspace package
- vite.config.ts — Vite build config with wwv globals
- tsconfig.json — TypeScript config extending base
- plugin.json — manifest for the WWV plugin registry
- src/index.ts — AviationAdsbPlugin class implementing WorldPlugin

### Next steps
- Plugin needs to be added to the WorldWideView production deployment on Vercel/Coolify
- The existing Aviation (OpenSky) layer can be disabled since its data source is unreachable
- Test the plugin appears in the Layers panel and shows live aircraft
```

**Then:**
```bash
cd /opt/data/toolbox && graphify update . --force 2>&1
```