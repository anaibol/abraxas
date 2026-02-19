import { extname, join } from "node:path";
import type { TileMap } from "@abraxas/shared";
import { BunWebSockets } from "@colyseus/bun-websockets";
import {
	createRouter,
	defineRoom,
	defineServer,
	type Router,
	type Server,
} from "@colyseus/core";
import { logger } from "./logger";
import { ArenaRoom } from "./rooms/ArenaRoom";
import { healthEndpoint, loginEndpoint, registerEndpoint } from "./routes";
import { MapService } from "./services/MapService";

process.on("uncaughtException", (e) => {
	logger.error({
		message: "UNCAUGHT EXCEPTION",
		error: String(e),
		stack: e.stack,
	});
});
process.on("unhandledRejection", (reason) => {
	logger.error({ message: "UNHANDLED REJECTION", reason: String(reason) });
});

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".wav": "audio/wav",
};

const COLYSEUS_PREFIXES = [
	"/health",
	"/api",
	"/matchmake",
	"/.colyseus",
	"/__healthcheck",
];

async function serveStatic(
	pathname: string,
	staticDir: string,
): Promise<Response> {
	const filePath = join(staticDir, pathname === "/" ? "index.html" : pathname);
	const file = Bun.file(filePath);

	if (await file.exists()) {
		return new Response(await file.arrayBuffer(), {
			headers: {
				"Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
			},
		});
	}

	const index = Bun.file(join(staticDir, "index.html"));
	return new Response(await index.arrayBuffer(), {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

// Extends BunWebSockets only to add SPA fallback for non-API routes.
// The URL parsing bug (url.pathname + url.search) is already fixed in
// @colyseus/bun-websockets@0.17.7, so no listen() override is needed.
class GameTransport extends BunWebSockets {
	constructor(private readonly staticDir?: string) {
		super();
	}

	override bindRouter(router: Router): void {
		const origHandler = router.handler.bind(router);
		const staticDir = this.staticDir;

		router.handler = (req: Request) => {
			const { pathname } = new URL(req.url);
			const isApiRoute = COLYSEUS_PREFIXES.some(
				(p) => pathname === p || pathname.startsWith(`${p}/`),
			);
			if (isApiRoute || !staticDir) return origHandler(req);
			return serveStatic(pathname, staticDir);
		};

		super.bindRouter(router);
	}
}

export async function createGameServer(options: {
	port: number;
	map: TileMap;
	staticDir?: string;
}): Promise<Server> {
	MapService.setMap("arena.test", options.map);
	MapService.setMap("arena", options.map);

	const server = defineServer({
		transport: new GameTransport(options.staticDir),
		devMode:
			process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test",
		rooms: { arena: defineRoom(ArenaRoom) },
		routes: createRouter({ healthEndpoint, registerEndpoint, loginEndpoint }),
	});

	await server.listen(options.port, "0.0.0.0");
	logger.info({ intent: "server_start", result: "ok", port: options.port });

	return server;
}
