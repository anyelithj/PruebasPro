import type { MetadataRoute } from "next";
// [robots.txt dinámico]: convención app/robots.ts | [Patrón]: Convention over Configuration | [Principio]: SSOT | [Paradigma]: Funcional

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/terms"],
        // [Disallow privadas]: portal no indexable (datos del usuario)
        disallow: ["/api/", "/dashboard", "/quiz", "/leaderboard", "/profile", "/assistant"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
