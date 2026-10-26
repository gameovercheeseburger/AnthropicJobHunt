import type { MetadataRoute } from "next";

/** Private beta: keep the site out of search engines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
