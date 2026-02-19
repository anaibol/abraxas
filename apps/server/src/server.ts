import {
	defineServer,
	defineRoom,
	createRouter,
	type Server,
	type Router,
} from "@colyseus/core";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { join, extname } from "path";
import { ArenaRoom } from "./rooms/ArenaRoom";
import type { TileMap } from "@abraxas/shared";
import { logger } from "./logger";
import { MapService } from "./services/MapService";
import { healthEndpoint, registerEndpoint, loginEndpoint } from "./routes";

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

// @colyseus/bun-websockets ignores the `express` callback entirely and returns
// 404 for all unmatched routes. We intercept `bindRouter` (called internally by
// defineServer) to handle SPA routes before the Colyseus router takes over.
function patchTransportForSPA(transport: BunWebSockets, staticDir: string) {
	const origBindRouter = transport.bindRouter.bind(transport);

	(
		transport as BunWebSockets & { bindRouter: (r: Router) => void }
	).bindRouter = (router) => {
		const origHandler = router.handler as (req: Request) => Promise<Response>;

		router.handler = (req: Request) => {
			const { pathname } = new URL(req.url);
			const isColyseusPath = COLYSEUS_PREFIXES.some(
				(p) => pathname === p || pathname.startsWith(`${p}/`),
			);
			return isColyseusPath
				? origHandler.call(router, req)
				: serveStatic(pathname, staticDir);
		};

		origBindRouter(router);
	};
}

export async function createGameServer(options: {
	port: number;
	map: TileMap;
	staticDir?: string;
}): Promise<Server> {
	MapService.setMap("arena.test", options.map);
	MapService.setMap("arena", options.map);

	const transport = new BunWebSockets();
	if (options.staticDir) patchTransportForSPA(transport, options.staticDir);

	const server = defineServer({
		transport,
		devMode:
			process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test",
		rooms: { arena: defineRoom(ArenaRoom) },
		routes: createRouter({ healthEndpoint, registerEndpoint, loginEndpoint }),
	});

	await server.listen(options.port, "0.0.0.0");
	logger.info({ intent: "server_start", result: "ok", port: options.port });

	return server;
}
