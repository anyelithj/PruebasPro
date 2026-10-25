// ChatWindow.tsx => ventana del asistente: lista de conversaciones + historial multi-turn + respuesta en streaming.
// La conversación activa vive en la URL (/chat?conversation=<id>): se puede recargar, compartir y usar "atrás".
// Accesibilidad: el historial es role="log" (los mensajes NUEVOS se anuncian una vez); la burbuja que se está
// escribiendo va aria-hidden para no leer cada token, y AITypingIndicator anuncia el estado.
// Patrón: Container Component (une datos de chat.api con componentes de presentación) + Observer (tokens SSE).
"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/shared/lib/i18n/navigation";
import { routes } from "@/shared/constants/routes";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";
import { cn } from "@/shared/lib/cn";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useMessageFeedback,
  useSendMessage,
} from "../api/chat.api";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { AITypingIndicator } from "./AITypingIndicator";

// ConversationList => barra lateral: nueva conversación, listado por cursor y borrado (GDPR). Componente propio:
// tiene sus propios datos (SRP) y la ventana queda más simple
function ConversationList({ activeId }: { activeId: string | null }) {
  const t = useTranslations("aiChat");
  const router = useRouter();
  const conversations = useConversations();
  const deleteConversation = useDeleteConversation();
  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];

  const onDelete = (id: string, title: string) => {
    // "confirm" nativo: accesible por teclado y lector de pantalla, sin JS extra
    if (!window.confirm(t("confirmDelete", { title }))) return;
    deleteConversation.mutate(id, {
      onSuccess: () => id === activeId && router.replace(routes.chat()),
    });
  };

  return (
    <aside
      aria-label={t("conversations")}
      className="flex max-h-44 flex-col gap-2 border-b border-slate-200 p-3 md:max-h-none md:border-b-0 md:border-r"
    >
      <Button
        size="sm"
        variant="secondary"
        onClick={() => router.push(routes.chat())}
        disabled={!activeId}
      >
        {t("new")}
      </Button>
      {conversations.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">{t("noConversations")}</p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {items.map((item) => {
            const title = item.title ?? t("untitled");
            return (
              <li key={item.id} className="group flex items-center gap-1">
                <Link
                  href={routes.chat(item.id)}
                  aria-current={item.id === activeId ? "page" : undefined}
                  className={cn(
                    "flex-1 truncate rounded-md px-2 py-2 text-sm hover:bg-slate-100",
                    item.id === activeId && "bg-slate-100 font-medium"
                  )}
                >
                  {title}
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(item.id, title)}
                  aria-label={t("delete", { title })}
                  className="h-8 w-8 shrink-0 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            );
          })}
          {conversations.hasNextPage && (
            <li>
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                loading={conversations.isFetchingNextPage}
                onClick={() => void conversations.fetchNextPage()}
              >
                {t("loadMore")}
              </Button>
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}

export function ChatWindow() {
  const router = useRouter();
  const activeId = useSearchParams().get("conversation");
  return (
    <div className="grid h-[calc(100dvh-12rem)] min-h-[32rem] grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-slate-200 md:grid-cols-[16rem_1fr] md:grid-rows-1">
      {/* Móvil: la lista va arriba con altura limitada; escritorio: barra lateral */}
      <ConversationList activeId={activeId} />
      <ChatThread activeId={activeId} onCreated={(id) => router.replace(routes.chat(id))} />
    </div>
  );
}

// ChatThread => historial + entrada de UNA conversación. Lo usan la página /chat (conversación en la URL) y la
// ventana flotante ChatWidget (conversación en estado local): misma lógica, dos presentaciones (DRY)
export function ChatThread({ activeId, onCreated }: { activeId: string | null; onCreated: (id: string) => void }) {
  const t = useTranslations("aiChat");
  const errorMessage = useErrorMessage();
  const conversation = useConversation(activeId);
  const createConversation = useCreateConversation();
  const feedback = useMessageFeedback(activeId ?? "");
  const chat = useSendMessage();
  const logRef = useRef<HTMLOListElement>(null);

  const isStreamingHere = chat.status === "streaming" && chat.conversationId === activeId;
  const messages = conversation.data?.messages ?? [];
  // La pregunta pendiente se pinta solo si el historial todavía no la trae (evita verla dos veces)
  const showPending = isStreamingHere && messages.at(-1)?.content !== chat.pendingContent;

  // Desplaza al final con cada mensaje o token nuevo (sin animación: no marea y no gasta frames)
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, chat.text]);

  // onSend => sin conversación activa crea una primero: el usuario escribe y listo (un paso menos)
  const onSend = async (content: string) => {
    const id = activeId ?? (await createConversation.mutateAsync());
    if (!activeId) onCreated(id);
    await chat.send(id, content);
  };

  return (
      <section aria-label={t("chat")} className="flex min-h-0 flex-1 flex-col">
        <ol
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={t("history")}
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {!activeId && (
            <li className="m-auto max-w-sm text-center text-sm text-slate-500">{t("welcome")}</li>
          )}
          {conversation.isLoading && (
            <li>
              <Skeleton className="h-20 w-2/3" />
            </li>
          )}
          {conversation.isError && (
            <li role="alert" className="text-sm text-red-600">
              {errorMessage(conversation.error)}
            </li>
          )}
          {messages.map((message) => (
            <li key={message.id}>
              <ChatMessage
                role={message.role}
                content={message.content}
                feedback={message.feedback}
                sources={message.sources}
                feedbackPending={feedback.isPending && feedback.variables?.messageId === message.id}
                {...(message.role === "assistant"
                  ? {
                      onFeedback: (value) =>
                        feedback.mutate({ messageId: message.id, feedback: value }),
                    }
                  : {})}
              />
            </li>
          ))}
          {showPending && (
            <li>
              <ChatMessage role="user" content={chat.pendingContent} />
            </li>
          )}
          {isStreamingHere && chat.text && (
            <li aria-hidden="true">
              <ChatMessage role="assistant" content={chat.text} />
            </li>
          )}
        </ol>
        {chat.status === "error" && chat.conversationId === activeId && (
          <p role="alert" className="mx-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage({ code: chat.errorCode }, t("error"))}
          </p>
        )}
        <div className="px-4">
          <AITypingIndicator active={isStreamingHere} tool={chat.tool} />
        </div>
        <ChatInput streaming={chat.status === "streaming"} onSend={onSend} onStop={chat.stop} />
      </section>
  );
}
