// LoyaltyTiers.tsx => tabla de niveles y beneficios; resalta el nivel actual (aria-current).
"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useLoyaltyAccount } from "../api/loyalty.api";
import { TIERS } from "../lib/loyalty.validator";
import { cn } from "@/shared/lib/cn";

export function LoyaltyTiers() {
  const t = useTranslations("loyalty");
  const format = useFormatter(); // Números con separadores del idioma actual (1.000 / 1,000)
  const { data: account } = useLoyaltyAccount();
  return (
    <section aria-labelledby="tiers-title" className="flex flex-col gap-3">
      <h2 id="tiers-title" className="text-lg font-semibold">
        {t("tiersTitle")}
      </h2>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <li key={tier.tier} aria-current={account?.tier === tier.tier ? "true" : undefined} className={cn("rounded-lg border p-4", account?.tier === tier.tier ? "border-slate-900 bg-slate-50" : "border-slate-200")}>
            <p className="font-semibold">{t(`tiers.${tier.tier}`)}</p>
            <p className="text-xs text-slate-500">{t("fromPoints", { points: format.number(tier.minPoints) })}</p>
            <ul className="mt-2 list-disc pl-4 text-sm text-slate-700">
              {/* "t.raw" => lista (arreglo JSON) de beneficios del nivel */}
              {(t.raw(`perks.${tier.tier}`) as string[]).map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
