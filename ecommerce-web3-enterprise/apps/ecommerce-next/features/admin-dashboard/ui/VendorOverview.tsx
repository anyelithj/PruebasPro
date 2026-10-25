// VendorOverview.tsx (Client Component · React + Tailwind) => portada del panel del VENDEDOR: SUS ventas con tendencia,
// su catálogo por estado, los pedidos que debe despachar, su stock crítico y sus productos más vendidos.
// Una sola petición (GET /dashboard/vendor: Express filtra por product.vendorId => nunca ve datos de otro vendedor).
// PanelOverview => elige la portada según el rol (Strategy): ADMIN el resumen global, VENDOR esta vista.
// Patrones: Facade (un hook alimenta toda la vista), Strategy (portada por rol), Composite (tarjetas como datos).
// Accesibilidad: <section> con nombre, tabla con <caption> (DataTable), enlaces reales con foco visible.
"use client"; // Directiva de Next.js: usa hooks (sesión, consulta, estado) => se ejecuta en el navegador

import { useTranslations } from "next-intl"; // next-intl: textos traducidos del namespace del panel
import { useVendorKpis } from "../api/dashboard.api"; // TanStack Query: KPIs del vendedor con caché
import { RANGES, rangeToDates, useAdminDashboard, type Range } from "../model/dashboard.store"; // Redux Toolkit: período elegido
import { DashboardOverview } from "./DashboardOverview";
import { KPICard } from "./KPICard";
import { DataTable } from "./DataTable";
import { SectionHeader, SelectField } from "./AdminFields";
import { useAuth } from "@/shared/hook/useAuth"; // Facade sobre la sesión de next-auth
import { useFormat } from "@/shared/hook/useFormat"; // Formato de moneda/fecha según el idioma
import { Link } from "@/shared/lib/i18n/navigation"; // Link con prefijo de idioma
import { routes } from "@/shared/constants/routes";

// PanelOverview => portada de /dashboard. Componentes SEPARADOS (y no un "if" dentro de uno solo): así cada uno llama
// solo a sus hooks y el VENDOR nunca dispara la petición de KPIs globales (solo-ADMIN => 403)
export function PanelOverview() {
  const { hasRole } = useAuth();
  return hasRole("ADMIN") ? <DashboardOverview /> : <VendorOverview />;
}

export function VendorOverview() {
  const t = useTranslations("admin.vendor");
  const tOverview = useTranslations("admin.overview"); // Textos compartidos con la portada del ADMIN (DRY)
  const format = useFormat();
  const { range, setRange } = useAdminDashboard();
  const { data, isLoading } = useVendorKpis(rangeToDates(range));

  // KPIS => tarjetas como datos (Composite): agregar un indicador = agregar una fila
  const KPIS = [
    { key: "revenueCents", label: t("revenue"), value: data && format.money(data.kpis.revenueCents.value), change: data?.kpis.revenueCents.change },
    { key: "orders", label: t("orders"), value: data?.kpis.orders.value.toLocaleString(), change: data?.kpis.orders.change },
    { key: "units", label: t("units"), value: data?.kpis.units.value.toLocaleString(), change: data?.kpis.units.change },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<SelectField label={tOverview("range")} value={range} onChange={(event) => setRange(event.target.value as Range)} options={RANGES.map((value) => ({ value, label: tOverview(`ranges.${value}`) }))} />}
      />

      {/* Ventas del período vs. el anterior (KPICard ya anuncia la tendencia con flecha + texto, no solo color) */}
      <section aria-label={t("sales")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {KPIS.map((kpi) => (
          <KPICard key={kpi.key} label={kpi.label} value={kpi.value ?? "—"} change={kpi.change} trendLabel={tOverview("vsPrevious")} />
        ))}
      </section>

      {/* Acciones rápidas: cada contador lleva a la sección donde se resuelve */}
      <section aria-label={tOverview("operations")} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href={routes.adminOrders} label={t("toShip")} value={data?.operations.activeOrders} />
        <QuickLink href={routes.adminProducts} label={tOverview("lowStock")} value={data?.operations.lowStock} />
        <QuickLink href={routes.adminProducts} label={t("published")} value={data?.products.ACTIVE} />
        <QuickLink href={routes.adminProducts} label={t("drafts")} value={data?.products.DRAFT} />
      </section>

      <DataTable
        caption={t("top")}
        loading={isLoading}
        rows={data?.topProducts}
        rowKey={(row) => row.name}
        columns={[
          { key: "name", header: tOverview("product"), cell: (row) => row.name },
          { key: "units", header: tOverview("units"), cell: (row) => row.units, className: "text-right" },
          { key: "revenue", header: tOverview("revenue"), cell: (row) => format.money(row.revenueCents), className: "text-right" },
        ]}
      />

      {/* Atajo principal del vendedor: publicar un producto nuevo */}
      <Link href={routes.adminProductNew} className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t("newProduct")}
      </Link>
    </div>
  );
}

// QuickLink => contador con enlace a su sección (mismo diseño que OperationLink de la portada del ADMIN)
function QuickLink({ href, label, value }: { href: string; label: string; value: number | undefined }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border bg-background p-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value ?? "—"}</span>
    </Link>
  );
}
