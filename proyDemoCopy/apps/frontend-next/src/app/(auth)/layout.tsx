import { PreferencesProvider } from "@/components/layout/PreferencesProvider";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { getDictionary } from "@aula/shared-i18n";
import { getLocale } from "@/lib/i18n-server";
import { Check } from "lucide-react"; // [Iconografía]: lucide (mismo set del portal) | Server Component → SVG sin JS en el cliente
// [Layout grupo (auth)]: navbar público + split 50/50 marca + formulario | [Patrón]: Composite + Provider | [Principio]: SRP + DRY (mismo navbar que la landing) | [Paradigma]: RSC + JSX

// `async` (RSC): el idioma sale de la cookie → login/registro se renderizan ya traducidos
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDictionary(locale).auth;
  return (
    // [PreferencesProvider]: tema (Claro/Oscuro) + idioma para los formularios cliente | [Patrón]: Provider
    <PreferencesProvider initialLocale={locale}>
      <div className="flex min-h-screen flex-col">
        <PublicNavbar />
        {/* [Rejilla · 2026-10-24]: fondo como antes (panel de marca a TODO el alto y ancho de su mitad); solo el TEXTO se alinea con el navbar
            `--edge` = margen del contenido del navbar: (100vw − 1240px)/2 + gutter de 24 px (si la ventana es más angosta, solo el gutter) | CSS `max()` + `calc()` */}
        <div className="grid flex-1 grid-cols-1 [--edge:max(1.5rem,calc((100vw-1240px)/2+1.5rem))] md:grid-cols-2">
          {/* [Panel marca]: degradado de marca con mensaje (oculto en móvil) */}
          <aside className="relative hidden flex-col justify-center overflow-hidden bg-gradient-brand py-12 pr-12 pl-(--edge) text-white md:flex lg:py-16 lg:pr-16">
            {/* [Decoración]: círculo borroso | aria-hidden: puramente visual */}
            <span className="pointer-events-none absolute -bottom-40 -right-40 size-[420px] rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative z-10 max-w-md">
              <h2 className="mb-3 text-3xl font-extrabold tracking-tight lg:text-4xl">{t.asideTitle}</h2>
              <p className="leading-relaxed text-white/85">{t.asideText}</p>
              {/* [Propuesta de valor]: 3 beneficios reales de la plataforma → el panel de marca informa en vez de quedar vacío | `<ul>` semántico: los lectores de pantalla anuncian «lista, 3 elementos» */}
              <ul className="mt-8 space-y-3">
                {t.asidePoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm font-medium text-white/95">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/40" aria-hidden="true">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* [Panel form]: centrado vertical | id main-content para el skip link */}
          {/* `md:justify-end` + `pr-(--edge)`: el borde derecho del formulario coincide con el botón «Registrarse» del navbar */}
          <main id="main-content" className="flex items-center justify-center bg-background p-6 sm:p-10 md:justify-end md:pr-(--edge) lg:py-16">
            {children}
          </main>
        </div>
      </div>
    </PreferencesProvider>
  );
}
