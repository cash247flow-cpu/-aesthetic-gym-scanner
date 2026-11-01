// Test-only stand-in for Upstash's REST API, backed by the same in-memory store the unit tests use.
//   https://localhost:8443  — what the app talks to (bearer token required, like Upstash)
//   http://127.0.0.1:8444   — test controls: /__health, /__reset, /__keys
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { memoryKV } from "../../lib/kv";
import { E2E } from "./env";

let kv = memoryKV();
const dir = process.env.E2E_CERT_DIR!;

https
  .createServer({ key: fs.readFileSync(path.join(dir, "key.pem")), cert: fs.readFileSync(path.join(dir, "cert.pem")) }, (req, res) => {
    if (req.headers.authorization !== `Bearer ${E2E.kvToken}`) return void res.writeHead(401).end('{"error":"Unauthorized"}');
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const out = await kv.pipeline(JSON.parse(body));
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out.map((r) => ({ result: r instanceof Set ? [...r] : r }))));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ error: String(e) }));
      }
    });
  })
  .listen(E2E.kvPort);

http
  .createServer((req, res) => {
    if (req.url === "/__reset") kv = memoryKV();
    if (req.url === "/__keys") return void res.end(JSON.stringify([...kv.dump().keys()]));
    res.end("ok");
  })
  .listen(E2E.kvAdminPort, "127.0.0.1");
