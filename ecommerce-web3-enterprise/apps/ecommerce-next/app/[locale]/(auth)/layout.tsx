// layout.tsx dentro de "(auth)" => "Route Group": las carpetas entre paréntesis NO agregan segmento a la URL
// (/login sigue siendo /login; /en/login en inglés), pero SÍ permiten un layout exclusivo para estas páginas.
// Cabecera = ESPEJO de la tienda Nuxt (widgets/navigation/StoreHeader.vue): marca, buscador, idioma, tema, carrito,
// iniciar sesión / registrarse y debajo categorías + secciones de contenido. Así el login se ve como parte de la tienda.
// Los enlaces apuntan a la tienda (otra app, misma sesión por SSO) con <a> normales.
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import type { AdminNav } from "@ecommerce/shared-types";
import navData from "@ecommerce/shared-types/admin-nav.json";
import { config } from "@/shared/constants/config";
import { apiRequest } from "@/shared/lib/api-client";
import { Link } from "@/shared/lib/i18n/navigation";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

// Textos de la cabecera de la tienda (mismos de Nuxt i18n "nav.*" y "store.search.*")
const TEXT = {
  es: { landings: "Promociones", lookbooks: "Lookbooks", collections: "Colecciones", categories: "Categorías", events: "Eventos", blog: "Blog", main: "Navegación principal", search: "Buscar productos, marcas o categorías", cart: "Carrito" },
  en: { landings: "Promotions", lookbooks: "Lookbooks", collections: "Collections", categories: "Categories", events: "Events", blog: "Blog", main: "Main navigation", search: "Search products, brands or categories", cart: "Cart" },
} as const;
// Secciones de contenido (mismo orden que LINKS de StoreHeader.vue)
const LINKS = [["/landing", "landings"], ["/cms-lookbook", "lookbooks"], ["/cms-collection", "collections"], ["/categories", "categories"], ["/events", "events"], ["/blog", "blog"]] as const;

const ROW_LINK = "shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const t = await getTranslations("nav.userMenu");
  const text = TEXT[locale];
  const nav = (navData as AdminNav).text;
  const store = `${config.cmsUrl}${locale === "en" ? "/en" : ""}`; // Tienda Nuxt en el mismo idioma
  // Categorías del menú (caché 5 min); si Express no responde, la cabecera sale sin ellas
  const categories = await apiRequest<CategoryNode[]>("/category", { next: { revalidate: 300 } })
    .then(({ data }) => data)
    .catch(() => []);

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <a href={store} className="shrink-0 text-lg font-bold text-slate-900">
            {config.siteName}
          </a>
          {/* Buscador: GET a /products?q= de la tienda (funciona sin JavaScript, igual que en Nuxt) */}
          <form action={`${store}/products`} method="get" role="search" className="mx-auto hidden w-full max-w-md md:block">
            <input type="search" name="q" aria-label={text.search} placeholder={text.search} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </form>
          <div className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/login" locale={locale === "es" ? "en" : "es"} hrefLang={locale === "es" ? "en" : "es"} className="rounded-md px-2 py-2 text-slate-600 hover:bg-slate-100">
              {locale === "es" ? "EN" : "ES"}
            </Link>
            <ThemeToggle labels={{ dark: nav.themeDark[locale], light: nav.themeLight[locale] }} />
            <a href={`${store}/cart`} aria-label={text.cart} title={text.cart} className="flex size-10 items-center justify-center rounded-md hover:bg-slate-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
                <path d="M3 7h18l-2 13H5L3 7Z" />
                <path d="M8 7a4 4 0 0 1 8 0" />
              </svg>
            </a>
            <Link href="/login" className="rounded-md px-3 py-2 text-slate-900 hover:bg-slate-100">
              {t("signIn")}
            </Link>
            <Link href="/register" className="rounded-md bg-slate-900 px-3 py-2 font-medium text-slate-50 hover:bg-slate-700">
              {t("register")}
            </Link>
          </div>
        </div>
        <nav aria-label={text.main} className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 pb-2 text-sm">
          {categories.map((category) => (
            <a key={category.id} href={`${store}/categories/${category.slug}`} className={`${ROW_LINK} font-medium`}>
              {category.name}
            </a>
          ))}
          {categories.length > 0 && <span aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-slate-200" />}
          {LINKS.map(([path, key]) => (
            <a key={path} href={`${store}${path}`} className={ROW_LINK}>
              {text[key]}
            </a>
          ))}
        </nav>
      </header>
      {/* flex-1 + centrado => el formulario queda centrado en el espacio bajo la barra (responsive por defecto) */}
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl bg-background p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
