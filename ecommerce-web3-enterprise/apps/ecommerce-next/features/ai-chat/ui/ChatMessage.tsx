// ChatMessage.tsx => burbuja de un turno del chat. Las respuestas del asistente llevan feedback 👍/👎 (botones con
// aria-pressed: el lector de pantalla anuncia cuál está marcado) y las fuentes RAG citadas ([n] en el texto).
// Patrón: Presentational Component (sin datos propios: todo llega por props). Paradigma: declarativo.
"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib/cn";
import type { Feedback } from "../lib/chat.validator";
import type { LlmSource } from "../api/chat.api";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  feedback?: Feedback | null;
  onFeedback?: (feedback: Feedback) => void; // Sin callback (mensaje en streaming) no se muestran los botones
  feedbackPending?: boolean;
  sources?: LlmSource[] | null; // Fuentes RAG: [1] título, [2] título... (el número coincide con la cita del texto)
}

const FEEDBACK: Array<{ value: Feedback; icon: string }> = [
  { value: "up", icon: "👍" },
  { value: "down", icon: "👎" },
];

export function ChatMessage({
  role,
  content,
  feedback = null,
  onFeedback,
  feedbackPending = false,
  sources,
}: ChatMessageProps) {
  const t = useTranslations("aiChat");
  const isUser = role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <span className="sr-only">{isUser ? t("you") : t("assistant")}:</span>
      {/* "whitespace-pre-wrap" => respeta los saltos de línea del modelo sin interpretar HTML (React escapa el texto: sin XSS) */}
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-slate-100 text-slate-900"
        )}
      >
        {content}
      </p>
      {sources && sources.length > 0 && (
        // <ol> numerada desde 1: el lector de pantalla anuncia "lista, 2 elementos" y el orden coincide con [n]
        <ol
          aria-label={t("sources")}
          className="max-w-[85%] list-inside list-decimal text-xs text-slate-500"
        >
          {sources.map((source) => (
            <li key={source.id} className="truncate">
              {source.title}
            </li>
          ))}
        </ol>
      )}
      {onFeedback && (
        <div role="group" aria-label={t("feedbackLabel")} className="flex gap-1">
          {FEEDBACK.map(({ value, icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={feedback === value}
              aria-label={t(`feedback.${value}`)}
              disabled={feedbackPending}
              onClick={() => onFeedback(value)}
              className={cn(
                "h-8 w-8 rounded-full text-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                feedback === value ? "bg-slate-200" : "opacity-60"
              )}
            >
              <span aria-hidden="true">{icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
