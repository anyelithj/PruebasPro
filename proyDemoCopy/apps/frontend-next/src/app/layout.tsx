import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/store/provider";
import { BRAND } from "@/config/brand";
import { THEME_INIT_SCRIPT } from "@aula/ui-tokens/tailwind-preset"; // [SSOT temas]: script que aplica el tema guardado antes de pintar
// [Root Layout]: layout HTML raíz Next.js | [Patrón]: Composite | [Principio]: SRP | [Paradigma]: Funcional + JSX

// [Inter font]: carga via next/font para zero layout shift | [Patrón]: Adapter (Google Fonts)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// [Metadata SEO]: Open Graph + Twitter + canonical | [Buena práctica]: SEO técnico
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7000"),
  title: {
    default: `${BRAND.name} — Aprende idiomas por niveles MCER (A1–C2)`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Aprende inglés, francés, alemán, español, portugués, chino mandarín y ruso con práctica por nivel MCER, correcciones explicadas y exámenes de práctica.",
  keywords: [
    "aprender idiomas",
    "MCER",
    "CEFR",
    "inglés",
    "francés",
    "alemán",
    "portugués",
    "chino mandarín",
    "ruso",
    "exámenes de práctica",
  ],
  authors: [{ name: BRAND.name }],
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: BRAND.name,
    title: `${BRAND.name} — Aprende idiomas por niveles MCER`,
    description:
      "Siete idiomas, niveles A1–C2, correcciones explicadas en español y exámenes de práctica.",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: "Aprende idiomas por niveles MCER (A1–C2)",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// [Viewport]: separado de metadata desde Next.js 15+
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A1A" }, // = --nl-bg del tema oscuro (antes slate, no casaba con la paleta)
  ],
};

// [RootLayout]: Server Component por defecto (no 'use client') | [Paradigma]: RSC
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` (React): el script de tema añade una clase a <html> antes de hidratar; es intencional y solo afecta a este nodo
    <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* [Anti-parpadeo de tema]: script bloqueante mínimo que aplica la clase guardada antes del primer pintado | [Patrón]: Blocking Inline Script | contenido 100% estático (sin datos del usuario) → sin riesgo de XSS */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* [Skip-to-content]: enlace accesibilidad teclado | [WCAG 2.4.1] */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Saltar al contenido
        </a>
        {/* [Provider Redux]: envuelve toda la app | [Patrón]: Provider (Context) */}
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
