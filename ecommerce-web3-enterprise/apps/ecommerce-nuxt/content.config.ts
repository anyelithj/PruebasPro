// content.config.ts (Nuxt Content v3) => colecciones de Markdown/MDC con esquema Zod (tipado de punta a punta).
// "page" => cada archivo es una página con ruta propia; los campos extra salen del frontmatter del .md.
// Contenido versionado en git: cero base de datos para el blog (ahorro de servidor y energía).
import { defineCollection, defineContentConfig, z } from "@nuxt/content";

export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: "page",
      source: "blog/**/*.md",
      schema: z.object({
        date: z.string(), // ISO (2026-10-05) => orden y JSON-LD BlogPosting
        author: z.string().default("Equipo eCommerce Web3"),
        category: z.string().default("general"),
        tags: z.array(z.string()).default([]),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        locale: z.enum(["es", "en"]).default("es"),
      }),
    }),
    pages: defineCollection({ type: "page", source: "pages/**/*.md" }),
    docs: defineCollection({ type: "page", source: "docs/**/*.md" }),
  },
});
