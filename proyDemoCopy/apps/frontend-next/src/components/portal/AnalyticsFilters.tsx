"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// [AnalyticsFilters]: select de periodo (meses) + botón Filtrar que escribe ?period= en la URL al hacer clic | [Patrón]: Controlled URL State (apply-on-submit) | [Principio]: SRP | [Paradigma]: Reactivo

// [Periodos soportados]: SSOT con backend (ALLOWED_PERIOD_MONTHS) | [Principio]: SSOT
const PERIODS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todo el histórico" },
  { value: "2", label: "Últimos 2 meses" },
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
];

const selectClass =
  "control";

export function AnalyticsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // [Estado local]: el periodo se aplica solo al pulsar "Filtrar" (no on-change) | [Patrón]: Apply-on-submit
  const [period, setPeriod] = useState(params.get("period") ?? "");

  const apply = () => {
    const next = new URLSearchParams(params.toString());
    if (period) next.set("period", period);
    else next.delete("period");
    // [Reset de página]: cambió el filtro | [Patrón]: Pagination Reset
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="period-filter">
        Periodo
      </label>
      <select
        id="period-filter"
        className={selectClass}
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {/* [2026-10-19]: `btn` del sistema (40 px, igual que el select y que «Exportar») → la barra queda alineada */}
      <button type="button" onClick={apply} className="btn btn-primary">
        Filtrar
      </button>
    </div>
  );
}
