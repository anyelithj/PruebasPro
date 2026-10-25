// useCMSBlocks.ts => fábrica de bloques del editor GrapesJS (patrón Factory): hero, texto, imagen, botón, testimonio,
// dos columnas y aviso. HTML semántico con estilos en línea (GrapesJS los convierte en reglas CSS editables): el
// contenido publicado no depende de Tailwind ni de CDNs externos (portabilidad y 0 peticiones extra).
// Accesibilidad: encabezados en orden, alt en imágenes, contraste AA en los colores por defecto.
import type { CmsBlock } from "~~/entities/cms/model/cms.types";

// block => crea un bloque con categoría (función pura; el id es único por tipo)
const block = (id: string, label: string, category: string, content: string): CmsBlock => ({ id, label, category, content });

export function useCMSBlocks(t: (key: string) => string): CmsBlock[] {
  const layout = t("cms.blocks.layout");
  const basic = t("cms.blocks.basic");
  return [
    block("hero", t("cms.blocks.hero"), layout, `<section style="padding:64px 24px;text-align:center;background:#0f172a;color:#fff"><h1 style="font-size:40px;margin:0 0 16px">${t("cms.blocks.heroTitle")}</h1><p style="font-size:18px;margin:0 0 24px">${t("cms.blocks.heroText")}</p><a href="/" style="display:inline-block;padding:12px 24px;background:#fff;color:#0f172a;border-radius:6px;text-decoration:none;font-weight:600">${t("cms.blocks.cta")}</a></section>`),
    block("two-columns", t("cms.blocks.columns"), layout, `<section style="display:flex;flex-wrap:wrap;gap:24px;padding:32px 24px"><div style="flex:1 1 280px"><h2 style="font-size:24px">${t("cms.blocks.title")}</h2><p>${t("cms.blocks.text")}</p></div><div style="flex:1 1 280px"><h2 style="font-size:24px">${t("cms.blocks.title")}</h2><p>${t("cms.blocks.text")}</p></div></section>`),
    block("text", t("cms.blocks.textBlock"), basic, `<section style="padding:24px;max-width:72ch;margin:0 auto"><h2 style="font-size:28px">${t("cms.blocks.title")}</h2><p style="line-height:1.6">${t("cms.blocks.text")}</p></section>`),
    block("image", t("cms.blocks.image"), basic, `<figure style="margin:0;padding:24px;text-align:center"><img src="https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/sample.jpg" alt="${t("cms.blocks.imageAlt")}" loading="lazy" style="max-width:100%;height:auto;border-radius:8px"/><figcaption style="font-size:14px;color:#475569">${t("cms.blocks.caption")}</figcaption></figure>`),
    block("button", t("cms.blocks.button"), basic, `<a href="/" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">${t("cms.blocks.cta")}</a>`),
    block("quote", t("cms.blocks.quote"), basic, `<blockquote style="margin:24px;padding:16px 24px;border-left:4px solid #2563eb;background:#f8fafc"><p style="font-size:18px;margin:0">“${t("cms.blocks.text")}”</p><cite style="font-size:14px;color:#475569">— ${t("cms.blocks.author")}</cite></blockquote>`),
    block("notice", t("cms.blocks.notice"), basic, `<aside role="note" style="margin:24px;padding:16px;border-radius:8px;background:#ecfdf5;color:#065f46">${t("cms.blocks.noticeText")}</aside>`),
  ];
}
