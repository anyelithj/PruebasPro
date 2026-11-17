// RewardsHistory.tsx => movimientos recientes de puntos (ganados/usados/vencidos) en tabla accesible.
"use client";

import { useLoyaltyAccount } from "../api/loyalty.api";
import { useFormatter, useTranslations } from "next-intl";
import { useFormat } from "@/shared/hook/useFormat";
import { TablePager, useLocalPage } from "@/features/admin-dashboard/ui/DataTable";

export function RewardsHistory() {
  const t = useTranslations("loyalty.history");
  const format = useFormatter();
  const { date } = useFormat();
  const { data: account } = useLoyaltyAccount();
  const rows = account?.recentTransactions ?? [];
  const page = useLocalPage(rows);
  if (rows.length === 0) return <p className="text-sm text-slate-600">{t("empty")}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <caption className="mb-2 text-left text-lg font-semibold">{t("title")}</caption>
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" className="py-2">{t("date")}</th>
            <th scope="col">{t("concept")}</th>
            <th scope="col" className="text-right">{t("points")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {page.visible.map((row) => (
            <tr key={row.id}>
              <td className="py-2">{date(row.createdAt)}</td>
              <td>{row.reason}</td>
              {/* Signo + texto: el color verde/rojo no es el único indicador (WCAG 1.4.1) */}
              <td className={row.operation === "ADD" ? "text-right text-green-700" : "text-right text-red-700"}>
                {row.operation === "ADD" ? "+" : "−"}
                {format.number(row.points)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager meta={page.meta} onPage={page.setPage} />
    </div>
  );
}
