"use client"; // [Next.js]: Client Component → lee y cambia la cookie del acento
import { useAccent } from "@/hooks/useVocabulary";
import { cn } from "@/lib/utils";
// [AccentSwitch · 2026-10-31]: interruptor UK/US del inglés, espejo de <aula-accent-switch> de Angular (mismo aspecto, misma cookie y mismo evento) | [Patrón]: Presentational + Observer | [Principio]: SSOT del acento
// [A11y]: `role="switch"` + `aria-checked` (WAI-ARIA Switch Pattern) · el estado se lee en texto («UK» / «US»), no solo por color (WCAG 1.4.1)

export function AccentSwitch() {
  const { accent, setAccent } = useAccent();
  const part = (on: boolean) => cn("rounded-full px-2 py-1 transition-colors", on ? "bg-gradient-brand text-white" : "text-muted-foreground");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={accent === "uk"}
      aria-label="Acento británico (UK)"
      onClick={() => setAccent(accent === "uk" ? "us" : "uk")}
      className="inline-flex h-7 items-center gap-0.5 rounded-full border border-border bg-muted p-0.5 text-[11px] font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={part(accent === "uk")}>🇬🇧 UK</span>
      <span className={part(accent === "us")}>🇺🇸 US</span>
    </button>
  );
}
