// AITypingIndicator.tsx => aviso "el asistente está escribiendo". La región role="status" (aria-live="polite") existe
// SIEMPRE y solo cambia su contenido: así los lectores de pantalla anuncian el cambio (una región que aparece de golpe
// no siempre se anuncia). Los puntos animados son decorativos (aria-hidden) y se detienen con "reducir movimiento".
"use client";

import { useTranslations } from "next-intl";

// "tool" => herramienta que el asistente consulta ("Consultando tu pedido…"); sin traducción ("t.has") o sin
// herramienta se muestra el texto genérico "escribiendo…"
export function AITypingIndicator({ active, tool }: { active: boolean; tool: string | null }) {
  const t = useTranslations("aiChat");
  const label = tool && t.has(`tools.${tool}`) ? t(`tools.${tool}`) : t("typing");
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex min-h-6 items-center gap-2 px-1 text-sm text-slate-500"
    >
      {active && (
        <>
          <span aria-hidden="true" className="flex gap-1">
            {/* "animation-delay" escalonado con style: cada punto rebota un poco después del anterior */}
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          {label}
        </>
      )}
    </p>
  );
}
