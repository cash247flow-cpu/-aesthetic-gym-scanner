// Content-Security-Policy for pages. A fresh nonce per request lets Next.js's own scripts run
// while any injected script is blocked. Allowances, and why:
//   style-src 'unsafe-inline' — React style={{…}} attributes and Next's font CSS (style
//                               attributes can't carry a nonce); scripts stay nonce-only.
//   img-src blob: data:       — on-phone photos, previews and exported certificate images.
//   frame-src youtube-nocookie — embedded exercise videos.
//   object-src blob:          — opening a saved PDF scan report from this phone.
// Development adds 'unsafe-eval' and ws: for Next's hot reload only.

export function buildCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    "frame-src https://www.youtube-nocookie.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
