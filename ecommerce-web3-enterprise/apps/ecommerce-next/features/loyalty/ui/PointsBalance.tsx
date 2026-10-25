// PointsBalance.tsx => saldo de puntos, nivel actual y progreso al siguiente (<progress> nativo accesible).
"use client";

import { useLoyaltyAccount } from "../api/loyalty.api";
import { useFormatter, useTranslations } from "next-intl";
import { TIERS } from "../lib/loyalty.validator";
import { Skeleton } from "@/shared/ui/Skeleton";

export function PointsBalance() {
  const t = useTranslations("loyalty.balance");
  const tCommon = useTranslations("common");
  const tTier = useTranslations("loyalty.tiers");
  const format = useFormatter();
  const { data: account, isLoading, isError } = useLoyaltyAccount();
  // Sin este guard, un error dejaba el esqueleto girando para siempre ("!account" nunca cambia)
  if (isError) return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{tCommon("sectionError")}</p>;
  if (isLoading || !account) return <Skeleton className="h-36 w-full" />;
  const currentMin = TIERS.find((tier) => tier.tier === account.tier)?.minPoints ?? 0;
  const nextMin = account.nextTier ? account.lifetimePoints + account.nextTier.pointsNeeded : account.lifetimePoints;

  return (
    <section aria-labelledby="points-title" className="flex flex-col gap-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white">
      <h2 id="points-title" className="text-sm uppercase tracking-wide text-slate-300">
        {t("tier", { tier: tTier(account.tier) })}
      </h2>
      <p className="text-4xl font-semibold">
        {format.number(account.pointsBalance)} <span className="text-lg font-normal">{t("points")}</span>
      </p>
      {account.nextTier ? (
        <>
          <progress max={nextMin - currentMin} value={account.lifetimePoints - currentMin} className="h-2 w-full" aria-label={t("progress")} />
          <p className="text-sm text-slate-200">
            {t("remaining", { points: format.number(account.nextTier.pointsNeeded), tier: tTier(account.nextTier.tier) })}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-200">{t("maxTier")}</p>
      )}
      {account.expiringSoon > 0 && <p className="text-sm text-amber-300">{t("expiring", { points: format.number(account.expiringSoon) })}</p>}
    </section>
  );
}
