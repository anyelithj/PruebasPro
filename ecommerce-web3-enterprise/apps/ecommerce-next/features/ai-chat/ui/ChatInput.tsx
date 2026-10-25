// ChatInput.tsx => caja de mensaje con Formik + Zod (useZodForm). Enter envía, Shift+Enter agrega una línea.
// Mientras llega la respuesta el botón cambia a "Detener" (cancela la generación: ahorra CPU del servidor).
// Patrón: Controlled Component + Command (onSend/onStop los decide el padre). Paradigma: declarativo.
"use client";

import type { KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/Button";
import { useZodForm } from "@/shared/hook/useZodForm";
import { MAX_MESSAGE_LENGTH, messageSchema, type MessageFormValues } from "../lib/chat.validator";

interface ChatInputProps {
  streaming: boolean;
  onSend: (content: string) => unknown;
  onStop: () => void;
}

export function ChatInput({ streaming, onSend, onStop }: ChatInputProps) {
  const t = useTranslations("aiChat");
  const tRoot = useTranslations();
  const form = useZodForm({
    schema: messageSchema,
    initialValues: { content: "" },
    onSubmit: (values: MessageFormValues, helpers) => {
      helpers.resetForm(); // Se limpia al instante; la pregunta se pinta como pendiente en la ventana
      return onSend(values.content);
    },
  });
  const error = form.error("content");

  // onKeyDown => Enter sin Shift envía; "isComposing" evita enviar a mitad de un acento o IME (teclados asiáticos)
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!streaming) form.handleSubmit();
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit}
      noValidate
      className="flex flex-col gap-1 border-t border-slate-200 p-3"
    >
      <div className="flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">
          {t("inputLabel")}
        </label>
        <textarea
          id="chat-input"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={t("placeholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "chat-input-error" : "chat-input-hint"}
          onKeyDown={onKeyDown}
          className="max-h-40 min-h-11 flex-1 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          {...form.getFieldProps("content")}
        />
        {streaming ? (
          <Button variant="secondary" onClick={onStop}>
            {t("stop")}
          </Button>
        ) : (
          <Button type="submit" loading={form.isSubmitting}>
            {t("send")}
          </Button>
        )}
      </div>
      {error ? (
        <p id="chat-input-error" role="alert" className="text-xs text-red-600">
          {tRoot(error)}
        </p>
      ) : (
        <p id="chat-input-hint" className="text-xs text-slate-500">
          {t("hint", { count: form.values.content.length, max: MAX_MESSAGE_LENGTH })}
        </p>
      )}
    </form>
  );
}
