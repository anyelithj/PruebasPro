// layout.tsx (ai) => chatbot IA (/chat) y recomendaciones (/recommendations) dentro del MISMO marco del panel
// (PanelFrame): aparecen como ítems del grupo "Mi cuenta" del menú lateral general. Rutas privadas (proxy.ts).
import type { ReactNode } from "react";
import { initPage } from "@/shared/lib/i18n/server";
import { PanelFrame } from "@/widgets/panel/PanelFrame";
import AuthBanner from "@/widgets/auth/AuthBanner"; // Aviso de sesión vencida

export default async function AiLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  await initPage(params); // Idioma de la request disponible para todo el árbol (render estático por locale)
  return <PanelFrame banner={<AuthBanner />}>{children}</PanelFrame>;
}
