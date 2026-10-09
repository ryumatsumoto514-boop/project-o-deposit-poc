import type { MetadataRoute } from "next";

// Allow crawlers to read the noindex metadata in layout.tsx. Disallowing
// crawling alone can still leave externally linked demo URLs in search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
