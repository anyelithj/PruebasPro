// layout.tsx dentro de "(auth)" => "Route Group": las carpetas entre paréntesis NO agregan segmento a la URL
// (/login sigue siendo /login; /en/login en inglés), pero SÍ permiten un layout exclusivo para estas páginas.
// Cabecera = widgets/store/StoreHeader.tsx, ESPEJO EXACTO de la tienda Nuxt (StoreHeader.vue): marca, buscador con
// voz/QR/imagen, idioma, tema, carrito, iniciar sesión / registrarse y categorías + secciones de contenido (SRP: este
// layout solo compone; la cabecera vive en su widget).
import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { StoreHeader } from "@/widgets/store/StoreHeader"; // Cabecera ÚNICA de la tienda (espejo de StoreHeader.vue)

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) === "en" ? "en" : "es"; // Estrechamiento a AdminLocale ("es" | "en")

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <StoreHeader locale={locale} />
      {/* flex-1 + centrado => el formulario queda centrado en el espacio bajo la barra (responsive por defecto).
          Mismo contenedor que la tienda: max-w-7xl + px-4 (alineado con la cabecera) */}
      <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl bg-background p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
