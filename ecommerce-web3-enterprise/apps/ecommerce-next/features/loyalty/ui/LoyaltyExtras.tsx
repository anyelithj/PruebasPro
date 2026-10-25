// LoyaltyExtras.tsx (Client Component · React + TanStack Query + Tailwind) => secciones del programa de fidelidad:
//  - RF-14.4 beneficios del nivel actual (descuento adicional, envío gratis, preventa, personal shopper) + solicitud
//  - RF-14.9 evento con puntos multiplicados vigente y logros (bloqueados / desbloqueados)
//  - RF-14.5 ranking por puntos históricos (nombres enmascarados) con la posición propia
//  - RF-14.1 código para referir amigos (copiar / compartir)
// Patrones: Composite (cada sección es un componente pequeño) + Facade (hooks de loyalty.api).
// Accesibilidad: <section> con títulos, tabla con <caption>, estados con texto (no solo color), aria-live al copiar.
"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useAchievements, useLoyaltyAccount, usePersonalShopper, useRanking, useReferral } from "../api/loyalty.api";
import { Button } from "@/shared/ui/Button";
import { toast } from "@/shared/ui/Toast";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { config } from "@/shared/constants/config";
import { cn } from "@/shared/lib/cn";

const SECTION = "flex flex-col gap-3 rounded-lg border border-slate-200 p-4";

export function LoyaltyBenefits() {
  const t = useTranslations("loyalty.extras");
  const tTier = useTranslations("loyalty.tiers");
  const format = useFormatter();
  const { data: account } = useLoyaltyAccount();
  if (!account) return null;
  const { benefits, activeMultiplier } = account;
  const rows: Array<[string, boolean, string?]> = [
    [t("extraDiscount", { percent: benefits.extraDiscountPercent }), benefits.extraDiscountPercent > 0],
    [t("freeShipping"), benefits.freeShipping],
    [t("preSale"), benefits.preSale],
    [t("personalShopper"), benefits.personalShopper],
  ];
  return (
    <section aria-labelledby="benefits-title" className={SECTION}>
      <h2 id="benefits-title" className="text-lg font-semibold">{t("benefitsTitle", { tier: tTier(account.tier) })}</h2>
      {activeMultiplier && (
        // RF-14.9 evento especial vigente (texto + emoji: no depende solo del color)
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span aria-hidden="true">⚡ </span>
          {t("multiplier", { name: activeMultiplier.name, multiplier: activeMultiplier.multiplier, date: format.dateTime(new Date(activeMultiplier.endsAt), { dateStyle: "medium" }) })}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {rows.map(([label, active]) => (
          <li key={label} className={cn("flex items-center gap-2", !active && "text-slate-400")}>
            <span aria-hidden="true">{active ? "✅" : "🔒"}</span>
            {label}
            <span className="sr-only">{active ? t("unlocked") : t("locked")}</span>
          </li>
        ))}
      </ul>
      {benefits.personalShopper && <PersonalShopperForm />}
    </section>
  );
}

function PersonalShopperForm() {
  const t = useTranslations("loyalty.extras");
  const errorMessage = useErrorMessage();
  const request = usePersonalShopper();
  const [message, setMessage] = useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        request.mutate(message, { onSuccess: () => { toast.success(t("shopperSent")); setMessage(""); }, onError: (error) => toast.error(errorMessage(error)) });
      }}
    >
      <label htmlFor="shopper-message" className="text-sm font-medium">{t("shopperLabel")}</label>
      <textarea id="shopper-message" rows={3} minLength={10} maxLength={1000} required value={message} onChange={(event) => setMessage(event.target.value)} className="rounded-md border border-slate-300 p-2 text-sm" />
      <Button type="submit" size="sm" loading={request.isPending} className="self-start">{t("shopperSubmit")}</Button>
    </form>
  );
}

export function Achievements() {
  const t = useTranslations("loyalty.extras");
  const { data = [] } = useAchievements();
  return (
    <section aria-labelledby="achievements-title" className={SECTION}>
      <h2 id="achievements-title" className="text-lg font-semibold">{t("achievementsTitle")}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.map((achievement) => (
          <li key={achievement.code} className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 text-center text-sm", achievement.unlockedAt ? "border-emerald-300 bg-emerald-50" : "border-slate-200 opacity-70")}>
            <span aria-hidden="true" className="text-2xl">{achievement.unlockedAt ? "🏆" : "🔒"}</span>
            <span className="font-medium">{achievement.name}</span>
            <span className="text-xs text-slate-600">{achievement.unlockedAt ? t("unlocked") : t("rewardPoints", { points: achievement.points })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Ranking() {
  const t = useTranslations("loyalty.extras");
  const tTier = useTranslations("loyalty.tiers");
  const format = useFormatter();
  const { data } = useRanking();
  if (!data) return null;
  return (
    <section aria-labelledby="ranking-title" className={SECTION}>
      <h2 id="ranking-title" className="text-lg font-semibold">{t("rankingTitle")}</h2>
      {data.me && <p className="text-sm">{t("myPosition", { position: data.me.position, points: format.number(data.me.lifetimePoints) })}</p>}
      <table className="w-full text-sm">
        <caption className="sr-only">{t("rankingTitle")}</caption>
        <thead className="border-b text-left text-slate-600">
          <tr><th scope="col" className="py-1 pr-2">#</th><th scope="col" className="py-1 pr-2">{t("member")}</th><th scope="col" className="py-1 pr-2">{t("tier")}</th><th scope="col" className="py-1 text-right">{t("points")}</th></tr>
        </thead>
        <tbody>
          {data.top.map((row) => (
            <tr key={row.position} className="border-b last:border-0">
              <td className="py-1 pr-2 tabular-nums">{row.position}</td>
              <td className="py-1 pr-2">{row.name}</td>
              <td className="py-1 pr-2">{tTier(row.tier)}</td>
              <td className="py-1 text-right tabular-nums">{format.number(row.lifetimePoints)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Referral() {
  const t = useTranslations("loyalty.extras");
  const { data } = useReferral();
  const [copied, setCopied] = useState(false);
  if (!data) return null;
  const link = `${config.siteUrl}/register?ref=${data.code}`; // El registro guarda quién lo refirió (RF-14.1)
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  };
  return (
    <section aria-labelledby="referral-title" className={SECTION}>
      <h2 id="referral-title" className="text-lg font-semibold">{t("referralTitle")}</h2>
      <p className="text-sm text-slate-700">{t("referralText", { points: data.points })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-slate-100 px-2 py-1 text-sm">{data.code}</code>
        <Button size="sm" variant="secondary" onClick={() => void copy()}>{t("copyLink")}</Button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Button size="sm" variant="secondary" onClick={() => void navigator.share({ title: t("referralTitle"), url: link })}>{t("share")}</Button>
        )}
      </div>
      <p aria-live="polite" className="text-xs text-emerald-700">{copied ? t("copied") : ""}</p>
    </section>
  );
}
