import type { MetadataRoute } from "next";
import { LANGUAGE_GROUPS } from "@/types/courses"; // [Sprint 7.13]: una URL indexable por idioma (/idiomas/[lang])
// [Sitemap dinámico]: convención app/sitemap.ts | [Patrón]: Convention over Configuration | [Principio]: SSOT | [Paradigma]: Funcional

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7000";
  const now = new Date();
  // [Rutas indexables]: solo páginas públicas. Portal es noindex
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // `...map` (ES2015 spread): páginas SSG por idioma + FAQ pública (Angular /ayuda/faq)
    ...LANGUAGE_GROUPS.map((g) => ({ url: `${base}/idiomas/${g.toLowerCase()}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${base}/ayuda/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];
}
