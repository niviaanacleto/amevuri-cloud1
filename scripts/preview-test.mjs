// Local preview with simulated providers. Never use this as the production server.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { harness } from "./harness.mjs";
const h = await harness();
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public",
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://127.0.0.1:4173");
      if (u.pathname.startsWith("/api/")) {
        let body = "";
        for await (const chunk of req) body += chunk;
        const r = await h.api(
          u.pathname + u.search,
          body || undefined,
          req.headers,
          req.method,
        );
        res.writeHead(r.status, { "content-type": "application/json" });
        res.end(r.status === 204 ? undefined : JSON.stringify(r.data));
        return;
      }
      let filename = path.resolve(root, "." + decodeURIComponent(u.pathname));
      if (!filename.startsWith(root + path.sep) && filename !== root) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (filename === root) filename = path.join(root, "index.html");
      else if (!path.extname(filename)) filename += ".html";
      if (!fs.existsSync(filename)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "content-type":
          types[path.extname(filename)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(filename).pipe(res);
    } catch (e) {
      res.writeHead(500);
      res.end("Local preview failed");
      console.error(e.message);
    }
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("LOCAL TEST ONLY http://127.0.0.1:4173"),
  );
