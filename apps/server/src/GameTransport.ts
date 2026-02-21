import { extname, join } from "node:path";
import { BunWebSockets } from "@colyseus/bun-websockets";
import type { Router } from "@colyseus/core";
import type { ServerWebSocket } from "bun";

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
  ".ogg": "audio/ogg",
};

const COLYSEUS_PREFIXES = ["/health", "/api", "/matchmake", "/.colyseus", "/__healthcheck"];

async function serveStatic(pathname: string, staticDir: string): Promise<Response> {
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

interface WebSocketData {
  url: string;
  searchParams: URLSearchParams;
  headers: Headers;
  remoteAddress: string;
}

export class GameTransport extends BunWebSockets {
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

  override async onConnection(rawClient: ServerWebSocket<WebSocketData>): Promise<void> {
    // Strip query string so the roomId regex in super.onConnection matches.
    rawClient.data.url = rawClient.data.url.split("?")[0];
    return super.onConnection(rawClient);
  }
}
