import type { MetadataRoute } from "next";

// Private app (behind a passcode, progress photos never leave the phone): nothing to crawl.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
