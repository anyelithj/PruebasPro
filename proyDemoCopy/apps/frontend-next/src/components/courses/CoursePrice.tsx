"use client"; // [Next.js]: Client Component → lee el idioma del contexto y admite el callback "Aplicar" (ProBono)
import { PartyPopper, Star } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { fmt } from "@aula/shared-i18n";
// [crp · CoursePrice]: bloque de precio del original (gratis / descuento + promoción / normal + equivalencia TNA + Beca ProBono) | [Patrón]: Presentational | [Principio]: SRP

export interface CoursePriceProps {
  price: number;
  originalPrice: number | null;
  isFree: boolean;
  tokens: number;
  discountPercent: number;
  isProBono: boolean;
  currency?: string;
  color?: string;
  onApplyProBono?: () => void;
}

const SUCCESS = "#9333EA"; // Morado de marca para "gratis"/"promoción" (paleta sin verdes)
const WARNING = "#F59E0B"; // Ámbar de la Beca ProBono (igual al original)

export function CoursePrice({
  price,
  originalPrice,
  isFree,
  tokens,
  discountPercent,
  isProBono,
  currency = "USD",
  color = "#6366F1",
  onApplyProBono,
}: CoursePriceProps) {
  const t = usePreferences().t.courses.price; // [i18n]: textos del bloque de precio
  const equiv = fmt(t.equiv, { tokens }); // "💎 Equiv. N TNA"

  return (
    <div className="mb-2.5 rounded-lg border border-border bg-muted px-2.5 py-2">
      {isFree ? (
        <span className="eeg-mono text-sm font-extrabold" style={{ color: SUCCESS }} aria-label={t.freeLabel}>
          {t.free}
        </span>
      ) : originalPrice && originalPrice > price ? (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            {/* `toFixed(2)` (JS): siempre 2 decimales */}
            <span className="eeg-mono text-[15px] font-extrabold" style={{ color }}>
              ${price.toFixed(2)} {currency}
            </span>
            <span className="eeg-mono text-[10px] text-muted-foreground line-through" aria-label={fmt(t.original, { price: `${originalPrice.toFixed(2)} ${currency}` })}>
              ${originalPrice.toFixed(2)}
            </span>
            <span className="rounded-full px-[7px] py-px text-[9px] font-bold" style={{ background: `${SUCCESS}18`, color: SUCCESS, border: `1px solid ${SUCCESS}33` }}>
              -{discountPercent}% <PartyPopper aria-hidden className="inline size-4 align-[-0.125em]" /> {t.promo}
            </span>
          </div>
          <div className="mt-[3px] text-[9px] text-muted-foreground">{equiv}</div>
        </>
      ) : (
        <>
          <span className="eeg-mono text-[15px] font-extrabold" style={{ color }}>
            ${price.toFixed(2)} {currency}
          </span>
          <div className="mt-[3px] text-[9px] text-muted-foreground">{equiv}</div>
        </>
      )}

      {/* [Beca ProBono]: solo en cursos de pago marcados como ProBono */}
      {isProBono && !isFree && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: `${WARNING}10`, border: `1px solid ${WARNING}33` }}>
          <span className="text-[10px]" aria-hidden>
            <Star aria-hidden className="mx-auto size-10 text-tone-brand" />
          </span>
          <span className="text-[9px] font-bold" style={{ color: WARNING }}>
            {t.probono}
          </span>
          {onApplyProBono && (
            <button
              type="button"
              onClick={onApplyProBono}
              className="ml-auto cursor-pointer rounded border-0 bg-transparent text-[9px] font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ color: WARNING }}
            >
              {t.apply}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
