import { resolve } from "path";
import type { TileMap } from "@abraxas/shared";
import { logger } from "../logger";

export class MapService {
    private static maps = new Map<string, TileMap>();
    private static mapsDir = resolve(import.meta.dir, "../../../packages/shared/src/maps");

    public static async getMap(mapName: string): Promise<TileMap | undefined> {
        if (this.maps.has(mapName)) {
            return this.maps.get(mapName);
        }

        try {
            const mapPath = resolve(this.mapsDir, `${mapName}.json`);
            console.log(`[MapService] Loading map "${mapName}" from: ${mapPath}`);
            const file = Bun.file(mapPath);
            if (!(await file.exists())) {
                console.log(`[MapService] Map file NOT found at: ${mapPath}`);
                logger.warn({ message: "Map file not found", mapName, path: mapPath });
                return undefined;
            }

            const mapData: TileMap = await file.json();
            console.log(`[MapService] Map "${mapName}" loaded successfully`);
            this.maps.set(mapName, mapData);
            return mapData;
        } catch (e) {
            console.error(`[MapService] Error loading map "${mapName}":`, e);
            logger.error({ message: "Error loading map", mapName, error: String(e) });
            return undefined;
        }
    }

    public static async preloadAll() {
        // Optional: Preload all maps in the directory
    }
}
