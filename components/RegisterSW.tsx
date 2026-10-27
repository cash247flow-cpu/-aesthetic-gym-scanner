"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds (dev reloads would fight the cache). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* the app still works without it */
    });
  }, []);
  return null;
}
