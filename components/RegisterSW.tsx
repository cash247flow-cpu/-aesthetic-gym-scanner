"use client";

import { useEffect } from "react";
import { requestPersistentStorage } from "@/lib/storageInfo";

/** Registers the service worker in production builds (dev reloads would fight the cache). */
export function RegisterSW() {
  useEffect(() => {
    // Ask the browser not to clear app data on its own under storage pressure (it may refuse).
    void requestPersistentStorage();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* the app still works without it */
    });
  }, []);
  return null;
}
