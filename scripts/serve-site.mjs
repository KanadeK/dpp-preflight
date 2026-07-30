import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "site");
const PORT = Number(process.argv[2] || 4173);
const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonld": "application/ld+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
  ".csv": "text/csv; charset=utf-8",
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = normalize(pathname).replace(/^[/\\]+/, "");
    let target = resolve(ROOT, relative);
    if (!target.startsWith(ROOT)) throw new Error("unsafe path");
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, "index.html");
    const bytes = await readFile(target);
    response.writeHead(200, {
      "Content-Type": TYPES[extname(target)] || "application/octet-stream",
      "Content-Length": bytes.length,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(bytes);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
  }
}).listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`DPP Preflight preview: http://127.0.0.1:${PORT}\n`);
});
