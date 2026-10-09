import type { MetadataRoute } from "next";

// Demo/PoC behind KOL referral links — not meant for search indexing.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
