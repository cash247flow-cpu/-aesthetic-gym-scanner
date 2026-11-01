// A throwaway self-signed certificate for the fake Upstash server (the app only talks to an
// https store). Generated per machine into e2e/.cache (git-ignored); never committed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function ensureCert() {
  const dir = path.resolve(__dirname, "../.cache");
  const certFile = path.join(dir, "cert.pem");
  const keyFile = path.join(dir, "key.pem");
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync(
      "openssl",
      ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", keyFile, "-out", certFile],
      { stdio: "ignore" },
    );
  }
  return { dir, certFile, keyFile };
}
