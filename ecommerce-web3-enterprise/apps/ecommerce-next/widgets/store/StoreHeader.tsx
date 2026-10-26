// StoreHeader.tsx (Server Component · React + Tailwind) => cabecera de la TIENDA dibujada por Next.js en login, registro
// y recuperación de contraseña. ESPEJO EXACTO de widgets/navigation/StoreHeader.vue (Nuxt): mismas clases, mismos
// íconos SVG (manifiesto compartido admin-nav.json), mismo buscador (StoreSearch) y mismo menú de categorías con
// <details> nativo => el usuario ve UNA sola aplicación aunque la pantalla la sirva otro microfrontend.
// Los enlaces apuntan a la tienda Nuxt (otra app, misma sesión por SSO) con <a> normales.
// Patrones: Composite (LINKS = datos), Shared Kernel (manifiesto), Adapter (store + ruta => URL de Nuxt).
// Rendimiento: Server Component (0 JS salvo el buscador, que es el único Client Component); categorías con ISR de 5 min.
import { getTranslations } from "next-intl/server"; // next-intl (servidor): textos traducidos sin enviar JS
import type { AdminLocale, AdminNav } from "@ecommerce/shared-types"; // "import type" => solo tipos
import navData from "@ecommerce/shared-types/admin-nav.json";
import { config } from "@/shared/constants/config";
import { apiRequest } from "@/shared/lib/api-client";
import { Link } from "@/shared/lib/i18n/navigation"; // Link con prefijo de idioma (next-intl)
import { ThemeToggle } from "@/shared/ui/ThemeToggle";
import { StoreSearch } from "@/features/search/ui/StoreSearch";

// interface => contrato del árbol de categorías que devuelve Express (GET /category); "children" recursivo
interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

const NAV = navData as AdminNav;
// Textos de la cabecera = los de Nuxt i18n "nav.*" y "store.*" ("as const" => literales de solo lectura)
const TEXT = {
  es: { landings: "Promociones", lookbooks: "Lookbooks", collections: "Colecciones", categories: "Categorías", events: "Eventos", blog: "Blog", main: "Navegación principal", cart: "Carrito: 0 productos", viewAll: "Ver todo" },
  en: { landings: "Promotions", lookbooks: "Lookbooks", collections: "Collections", categories: "Categories", events: "Events", blog: "Blog", main: "Main navigation", cart: "Cart: 0 items", viewAll: "View all" },
} as const;
// Secciones de contenido (mismo orden que LINKS de StoreHeader.vue)
const LINKS = [["/landing", "landings"], ["/cms-lookbook", "lookbooks"], ["/cms-collection", "collections"], ["/categories", "categories"], ["/events", "events"], ["/blog", "blog"]] as const;

// Clases compartidas con StoreHeader.vue (DRY entre microfrontends)
const ICON_LINK = "relative flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900";
const ROW_LINK = "shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100";

// "async function" => Server Component asíncrono: espera textos y categorías en el servidor antes de enviar HTML
export async function StoreHeader({ locale }: { locale: AdminLocale }) {
  const t = await getTranslations("nav.userMenu");
  const text = TEXT[locale];
  const store = `${config.cmsUrl}${locale === "en" ? "/en" : ""}`; // Tienda Nuxt en el mismo idioma
  const other = locale === "es" ? "en" : "es"; // Idioma alterno del selector
  // Categorías del menú (caché 5 min); si Express no responde, la cabecera sale sin ellas (degradación elegante)
  const categories = await apiRequest<CategoryNode[]>("/category", { next: { revalidate: 300 } })
    .then(({ data }) => data)
    .catch(() => []);

  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <a href={store} className="shrink-0 text-lg font-bold text-slate-900">
          {config.siteName}
        </a>
        <div className="mx-auto hidden w-full max-w-md md:block">
          <StoreSearch id="store-search" locale={locale} store={store} />
        </div>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/login" locale={other} hrefLang={other} className="flex h-9 items-center rounded-md px-2 font-medium text-slate-600 hover:bg-slate-100">
            {other.toUpperCase()}
          </Link>
          <ThemeToggle labels={{ dark: NAV.text.themeDark[locale], light: NAV.text.themeLight[locale] }} />
          {/* Carrito: vive en la tienda (pide iniciar sesión, igual que en Nuxt para visitantes) */}
          <a href={`${store}/cart`} aria-label={text.cart} title={text.cart} className={ICON_LINK}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true" dangerouslySetInnerHTML={{ __html: NAV.icons.cart ?? "" }} />
          </a>
          <Link href="/login" className="flex h-9 items-center rounded-md px-3 font-medium text-slate-900 hover:bg-slate-100">
            {t("signIn")}
          </Link>
          <Link href="/register" className="flex h-9 items-center rounded-md bg-slate-900 px-3 font-medium text-slate-50 hover:bg-slate-700">
            {t("register")}
          </Link>
        </div>
      </div>
      {/* Buscador móvil: segunda fila a todo el ancho (igual que Nuxt) */}
      <div className="px-4 pb-3 md:hidden">
        <StoreSearch id="store-search-mobile" locale={locale} store={store} compact />
      </div>
      <nav aria-label={text.main} className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {categories.map((category) =>
          category.children.length ? (
            // <details> nativo => desplegable accesible por teclado sin JavaScript (mismo marcado que Nuxt)
            <details key={category.id} className="group relative shrink-0">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
                {category.name} <span aria-hidden="true" className="transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="absolute left-0 z-40 mt-2 min-w-56 rounded-md border bg-white p-3 shadow-lg">
                <a href={`${store}/categories/${category.slug}`} className="mb-2 block font-semibold hover:underline">
                  {text.viewAll} {category.name}
                </a>
                {category.children.map((child) => (
                  <a key={child.id} href={`${store}/categories/${child.slug}`} className="block rounded px-2 py-1 text-slate-700 hover:bg-slate-50">
                    {child.name}
                  </a>
                ))}
              </div>
            </details>
          ) : (
            <a key={category.id} href={`${store}/categories/${category.slug}`} className={`${ROW_LINK} font-medium`}>
              {category.name}
            </a>
          )
        )}
        {categories.length > 0 && <span aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-slate-200" />}
        {LINKS.map(([path, key]) => (
          <a key={path} href={`${store}${path}`} className={ROW_LINK}>
            {text[key]}
          </a>
        ))}
      </nav>
    </header>
  );
}
