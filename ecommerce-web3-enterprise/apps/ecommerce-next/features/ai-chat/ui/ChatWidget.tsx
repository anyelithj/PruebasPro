// ChatWidget.tsx => chat flotante del asistente IA (burbuja abajo a la derecha + ventana tipo mensajería).
// Diseño propio (cabecera con degradado, tarjeta redondeada, sombra) distinto al menú lateral del panel. La conversación
// activa vive en estado local (no en la URL): se puede chatear sin salir de la pantalla actual. Reutiliza ChatThread.
// Accesibilidad: role="dialog" no modal con nombre, Escape cierra, el botón refleja aria-expanded.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/shared/lib/i18n/navigation";
import { routes } from "@/shared/constants/routes";
import { cn } from "@/shared/lib/cn";
import { useConversations } from "../api/chat.api";
import { ChatThread } from "./ChatWindow";

const HEAD_BUTTON = "flex size-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
    <path d={d} />
  </svg>
);

export function ChatWidget() {
  const t = useTranslations("aiChat");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const conversations = useConversations();
  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3" onKeyDown={(event) => event.key === "Escape" && setOpen(false)}>
      {open && (
        <div role="dialog" aria-label={t("title")} className="flex h-[min(36rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Cabecera: degradado de marca, avatar del asistente, selector de conversación y acciones */}
          <header className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2.5 text-white">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold" aria-hidden="true">IA</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t("title")}</p>
              <label className="sr-only" htmlFor="chat-widget-conversation">{t("conversations")}</label>
              <select
                id="chat-widget-conversation"
                value={activeId ?? ""}
                onChange={(event) => setActiveId(event.target.value || null)}
                className="w-full truncate rounded bg-transparent text-xs text-white/85 focus:outline-none [&>option]:text-slate-900"
              >
                <option value="">{t("new")}</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.title ?? t("untitled")}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => setActiveId(null)} title={t("new")} aria-label={t("new")} className={HEAD_BUTTON}>
              {icon("M12 5v14M5 12h14")}
            </button>
            <Link href={routes.chat(activeId ?? undefined)} title={t("openFull")} aria-label={t("openFull")} className={HEAD_BUTTON}>
              {icon("M14 4h6v6M20 4l-8 8M10 20H4v-6")}
            </Link>
            <button type="button" onClick={() => setOpen(false)} title={t("close")} aria-label={t("close")} className={HEAD_BUTTON}>
              {icon("M6 6l12 12M18 6 6 18")}
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
            <ChatThread activeId={activeId} onCreated={setActiveId} />
          </div>
        </div>
      )}
      {/* Burbuja: abre/cierra la ventana sin cambiar de página */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={open ? t("close") : t("title")}
        className={cn("flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300", open && "rotate-90")}
      >
        <span className="sr-only">{open ? t("close") : t("title")}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12Z" />}
        </svg>
      </button>
    </div>
  );
}
