// page.tsx (/chat) => asistente de compras con IA (LLM local Ollama vía FastAPI, respuesta en streaming SSE).
// Server Component: solo título y metadatos; ChatWindow (Client Component) se hidrata dentro de Suspense porque lee la
// conversación activa de la URL (useSearchParams). Ruta privada: el middleware exige sesión y no se indexa (robots).
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ChatWindow } from "@/features/ai-chat/ui/ChatWindow";
import { Skeleton } from "@/shared/ui/Skeleton";
import { initPage } from "@/shared/lib/i18n/server";
import type { PageProps } from "@/shared/types/next.types";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "aiChat" });
  return { title: t("title"), robots: { index: false, follow: false } }; // Conversaciones privadas: fuera de buscadores
}

export default async function ChatPage({ params }: PageProps) {
  await initPage(params);
  const t = await getTranslations("aiChat");
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-slate-600">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[32rem] w-full" />}>
        <ChatWindow />
      </Suspense>
    </section>
  );
}
