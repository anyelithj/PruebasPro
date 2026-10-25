// SocialShare.tsx => compartir una publicación o producto. Primero la Web Share API nativa (hoja de compartir del
// sistema en móvil, sin SDKs de redes); si no existe, copia el enlace. Los enlaces a WhatsApp, Facebook y X son URLs
// de "intent" simples: funcionan sin JavaScript y sin cargar scripts de terceros (privacidad y ahorro de datos).
// Patrón: Strategy (compartir nativo o copiar) + Progressive Enhancement.
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/Button";
import { toast } from "@/shared/ui/Toast";

export function SocialShare({ url, title }: { url: string; title: string }) {
  const t = useTranslations("social.share");
  const text = encodeURIComponent(title);
  const link = encodeURIComponent(url);
  const intents = [
    { key: "whatsapp", href: `https://wa.me/?text=${text}%20${link}` },
    { key: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${link}` },
    { key: "x", href: `https://x.com/intent/post?text=${text}&url=${link}` },
  ] as const;

  const share = async () => {
    try {
      // Detección de capacidad (feature detection), no del navegador: Safari/Chrome móvil la tienen, Firefox escritorio no
      if (typeof navigator.share === "function") await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("copied"));
      }
    } catch (error) {
      // "AbortError" => el usuario cerró la hoja de compartir: no es un error
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(t("failed"));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => void share()}>
        {t("share")}
      </Button>
      {intents.map((intent) => (
        // "noopener noreferrer" => la pestaña nueva no accede a window.opener ni recibe el Referer (seguridad/privacidad)
        <a
          key={intent.key}
          href={intent.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-2 py-1 text-sm text-slate-700 underline-offset-4 hover:underline"
        >
          {t(intent.key)}
          <span className="sr-only"> {t("newTab")}</span>
        </a>
      ))}
    </div>
  );
}
