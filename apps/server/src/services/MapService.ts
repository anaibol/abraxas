import { resolve } from "path";
import type { TileMap } from "@abraxas/shared";
import { logger } from "../logger";

export class MapService {
    private static maps = new Map<string, TileMap>();
    private static mapsDir = resolve(import.meta.dir, "../../../packages/shared/src/maps");

    public static setMap(mapName: string, mapData: TileMap) {
        this.maps.set(mapName, mapData);
    }

    public static async getMap(mapName: string): Promise<TileMap | undefined> {
        if (this.maps.has(mapName)) {
            return this.maps.get(mapName);
        }

        try {
            const mapPath = resolve(this.mapsDir, `${mapName}.json`);
            logger.info({ message: `[MapService] Loading map "${mapName}" from: ${mapPath}` });
            const file = Bun.file(mapPath);
            if (!(await file.exists())) {
                logger.warn({ message: `[MapService] Map file NOT found at: ${mapPath}` });
                logger.warn({ message: "Map file not found", mapName, path: mapPath });
                return undefined;
            }

            const mapData: TileMap = await file.json();
            logger.info({ message: `[MapService] Map "${mapName}" loaded successfully` });
            this.maps.set(mapName, mapData);
            return mapData;
        } catch (e) {
            logger.error({ message: `[MapService] Error loading map "${mapName}": ${e}` });
            logger.error({ message: "Error loading map", mapName, error: String(e) });
            return undefined;
        }
    }

    public static async preloadAll() {
        // Optional: Preload all maps in the directory
    }
}
