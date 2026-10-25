import type { DetailedHTMLProps, HTMLAttributes } from "react";
// [Tipos de los Angular Elements]: etiquetas personalizadas del remoto Angular usables en JSX con atributos tipados | [Patrón]: Module Augmentation (TS) | [Principio]: Type-Safe
// [Tecnología]: React 19 pasa los atributos de los custom elements tal cual (kebab-case)

type ElementProps<A> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & A;

declare module "react" {
  // `namespace JSX` (React 19): IntrinsicElements admite etiquetas nuevas por augmentación
  namespace JSX {
    interface IntrinsicElements {
      // <aula-exportar period-months="6">: botones PDF / Excel (features/reports)
      "aula-exportar": ElementProps<{ "period-months"?: number | string }>;
      // <aula-campana href="/notificaciones">: contador de avisos en vivo (features/notifications)
      "aula-campana": ElementProps<{ href?: string }>;
      // <aula-guia-widget>: botón flotante del Agente Guía (features/help · Sprint 7.11)
      "aula-guia-widget": ElementProps<object>;
      // <aula-ipa-text text="umbrella" language="en">: texto con IPA UK/US, traducción y sonido (features/vocabulary · Sprints 8.3/8.4)
      "aula-ipa-text": ElementProps<{ text: string; language: string; "with-translation"?: "true" | "false"; "with-switch"?: "true" | "false"; "ipa-only"?: "true" | "false" }>; // [2026-10-23]: ipa-only bajo ejemplos
      // <aula-word-lookup text="I run every day" language="en">: cada palabra se pulsa y abre el diccionario (shared/ui/organisms/word-lookup · Sprints 10.3/10.4)
      "aula-word-lookup": ElementProps<{ text: string; language: string }>;
    }
  }
}
