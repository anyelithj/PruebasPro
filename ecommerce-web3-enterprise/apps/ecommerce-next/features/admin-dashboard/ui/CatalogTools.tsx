// CatalogTools.tsx (Client Components · React + TanStack Query + Formik/Zod + Tailwind) => herramientas del catálogo del
// panel: exportar e importar productos en Excel/CSV y editar en lote (RF-04.3), y la gestión de MARCAS con historia,
// país, insignias premium/exclusiva (RF-05.1/05.3) y sus estadísticas de ventas (RF-05.4).
// Patrones: Composite (piezas que ProductsAdmin monta en su barra), Command (MutationRequest), Facade (dashboard.api),
// Render Props (DialogButton/AdminResource.bulk). Paradigma declarativo + funcional. Principios: SRP (cada herramienta
// es un componente), DRY (AdminResource y DialogButton reutilizados). Accesibilidad: input de archivo con etiqueta,
// resultados en role="status", tabla de ventas con <caption> y encabezados <th scope>.
"use client"; // Directiva de Next.js: estado, eventos y descargas => se ejecuta en el navegador

import { useRef, useState } from "react"; // Hooks de React: referencia al <input type="file"> y estado local
import Image from "next/image"; // Imagen optimizada de Next.js (lazy + tamaños)
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query"; // Invalidación de cachés tras importar
import { downloadAuthed, uploadAuthed, useAdminGet, type MutationRequest } from "../api/dashboard.api";
import { AdminResource, DialogButton, toOptions, useAdminCommand } from "./AdminResource";
import { SelectField } from "./AdminFields";
import { brandSchema, PRODUCT_BADGES, productBulkSchema } from "../lib/dashboard.validator";
import type { Brand, BrandStats, CategoryNode } from "@/entities/product/model/product.types";
import { useAuth } from "@/shared/hook/useAuth";
import { useFormat } from "@/shared/hook/useFormat";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { useZodForm } from "@/shared/hook/useZodForm";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { Skeleton } from "@/shared/ui/Skeleton";
import { toast } from "@/shared/ui/Toast";

// ---------- RF-04.3 Exportar / importar ----------

// ExportButtons => descarga la hoja con los filtros actuales del servidor (VENDOR: solo sus productos)
export function ExportButtons() {
  const t = useTranslations("admin.products");
  const { accessToken } = useAuth();
  const errorMessage = useErrorMessage();
  const date = new Date().toISOString().slice(0, 10);
  // "as const" => tupla de solo lectura: el formato solo puede ser "xlsx" o "csv"
  const download = (format: "xlsx" | "csv") =>
    downloadAuthed(`/product/export?format=${format}`, `productos-${date}.${format}`, accessToken ?? "").catch((error: unknown) => toast.error(errorMessage(error)));
  return (
    <>
      <Button variant="secondary" onClick={() => void download("xlsx")}>{t("export")}</Button>
      <Button variant="secondary" onClick={() => void download("csv")}>{t("exportCsv")}</Button>
    </>
  );
}

interface ImportResult {
  created: number;
  updated: number;
  errors: Array<{ rows: number[]; slug: string; message: string }>;
}

// ImportButton => el <input type="file"> real está oculto visualmente (sr-only) y lo abre un botón: mismo estilo que el
// resto de la barra y sigue siendo accesible. El resultado (y las filas con error) se muestran en un diálogo.
export function ImportButton() {
  const t = useTranslations("admin.products");
  const { accessToken } = useAuth();
  const errorMessage = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await uploadAuthed<ImportResult>("/product/import", file, accessToken ?? "");
      setResult(data);
      toast.success(t("importDone", { created: data.created, updated: data.updated, errors: data.errors.length }));
      // Observer: solo se recargan las listas afectadas (productos e inventario)
      await Promise.all(["products", "inventory"].map((resource) => queryClient.invalidateQueries({ queryKey: ["admin", resource] })));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // Permite volver a elegir el mismo archivo
    }
  };

  return (
    <>
      <label className="sr-only" htmlFor="product-import">{t("import")}</label>
      <input id="product-import" ref={input} type="file" accept=".xlsx,.csv" className="sr-only" onChange={(event) => void onFile(event.target.files?.[0])} />
      <Button variant="secondary" loading={busy} title={t("importHint")} onClick={() => input.current?.click()}>
        {busy ? t("importing") : t("import")}
      </Button>
      {result && result.errors.length > 0 && (
        <DialogButton label={t("importErrors")} title={t("importErrors")} variant="ghost" size="md">
          {() => (
            <ul role="status" className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
              {result.errors.map((item) => (
                <li key={`${item.slug}-${item.rows.join(",")}`} className="rounded border border-red-200 p-2">
                  <p className="font-medium">{item.slug || "—"} · {item.rows.join(", ")}</p>
                  <p className="text-red-700">{item.message}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogButton>
      )}
    </>
  );
}

// ---------- RF-04.3 Edición en lote ----------

// flatten => árbol de categorías -> opciones con sangría (función pura y recursiva)
const flatten = (nodes: CategoryNode[], depth = 0): Array<{ value: string; label: string }> =>
  nodes.flatMap((node) => [{ value: node.id, label: `${"— ".repeat(depth)}${node.name}` }, ...flatten(node.children, depth + 1)]);

// BulkEditForm => solo viajan los campos elegidos (un select en "Sin cambios" no toca ese dato)
function BulkEditForm({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const t = useTranslations("admin.products");
  const command = useAdminCommand(["products"]);
  const categories = useAdminGet<CategoryNode[]>("categories", "/category");
  const brands = useAdminGet<Brand[]>("brands", "/brand", { limit: 100 });
  const keep = { value: "", label: t("noChange") };
  const form = useZodForm({
    schema: productBulkSchema,
    initialValues: { status: "", categoryId: "", brandId: "", badges: [], replaceBadges: false },
    onSubmit: async (values) => {
      // "Spread condicional" => el PATCH solo lleva lo que se quiere cambiar
      const changes = {
        ...(values.status ? { status: values.status } : {}),
        ...(values.categoryId ? { categoryId: values.categoryId } : {}),
        ...(values.brandId ? { brandId: values.brandId } : {}),
        ...(values.replaceBadges ? { badges: values.badges } : {}),
      };
      const request: MutationRequest = { path: "/product/bulk", method: "PATCH", body: { ids, changes } };
      if (await command.run(request, t("bulkDone", { count: ids.length }))) onDone();
    },
  });
  const badges = form.values.badges;
  return (
    <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-4">
      <SelectField label={t("status")} options={[keep, ...toOptions(["DRAFT", "ACTIVE", "ARCHIVED"], (value) => t(`statuses.${value}`))]} {...form.getFieldProps("status")} />
      <SelectField label={t("category")} options={[keep, ...flatten(categories.data ?? [])]} {...form.getFieldProps("categoryId")} />
      <SelectField label={t("brand")} options={[keep, ...(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name }))]} {...form.getFieldProps("brandId")} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("badges")}</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" {...form.getFieldProps({ name: "replaceBadges", type: "checkbox" })} /> {t("bulkEdit")}</label>
        <div className="flex flex-wrap gap-3">
          {PRODUCT_BADGES.map((badge) => (
            <label key={badge} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" disabled={!form.values.replaceBadges} checked={badges.includes(badge)} onChange={() => void form.setFieldValue("badges", badges.includes(badge) ? badges.filter((item) => item !== badge) : [...badges, badge])} />
              {t(`badge.${badge}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" loading={form.isSubmitting} className="self-start">{t("bulkApply")}</Button>
    </form>
  );
}

// BulkEditButton => se pasa como "bulk" de AdminResource (recibe los IDs elegidos y "clear")
export function BulkEditButton({ ids, clear }: { ids: string[]; clear: () => void }) {
  const t = useTranslations("admin.products");
  return (
    <DialogButton label={t("bulkEdit")} title={t("bulkTitle", { count: ids.length })} size="sm">
      {(close) => <BulkEditForm ids={ids} onDone={() => { close(); clear(); }} />}
    </DialogButton>
  );
}

// ---------- RF-05.1 / 05.3 / 05.4 Marcas ----------

// BrandStatsView => KPIs + más vendidos + ventas de 12 meses (tabla accesible; sin librería de gráficos)
function BrandStatsView({ brand }: { brand: Brand }) {
  const t = useTranslations("admin.brands");
  const { money } = useFormat();
  const stats = useAdminGet<BrandStats>("brand-stats", `/brand/${brand.id}/stats`);
  if (!stats.data) return <Skeleton className="h-40 w-full" />;
  const { orders, units, revenueCents, topProducts, monthly } = stats.data;
  if (orders === 0) return <p className="text-sm text-slate-600">{t("noSales")}</p>;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="grid grid-cols-3 gap-3">
        {[[t("orders"), orders], [t("units"), units], [t("revenue"), money(revenueCents)]].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border p-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="brand-top">
        <h3 id="brand-top" className="mb-2 font-medium">{t("top")}</h3>
        <ol className="flex flex-col gap-1">
          {topProducts.map((item) => (
            <li key={item.productName} className="flex justify-between gap-2"><span className="truncate">{item.productName}</span><span className="tabular-nums">{item.units} · {money(item.revenueCents)}</span></li>
          ))}
        </ol>
      </section>
      <table className="w-full text-left">
        <caption className="mb-2 text-left font-medium">{t("monthly")}</caption>
        <thead><tr><th scope="col">{t("month")}</th><th scope="col" className="text-right">{t("units")}</th><th scope="col" className="text-right">{t("revenue")}</th></tr></thead>
        <tbody>
          {monthly.map((row) => (
            <tr key={row.month} className="border-t"><td>{row.month}</td><td className="text-right tabular-nums">{row.units}</td><td className="text-right tabular-nums">{money(row.revenueCents)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// BrandsTab => CRUD de marcas (solo ADMIN crea/edita; el VENDOR consulta) con insignias y ventas
export function BrandsTab() {
  const t = useTranslations("admin.brands");
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const fields = [
    { name: "name", label: t("name") },
    { name: "description", label: t("description"), type: "textarea" as const },
    { name: "story", label: t("story"), type: "textarea" as const },
    { name: "country", label: t("country"), hint: t("countryHint") },
    { name: "website", label: t("website"), type: "url" as const },
    { name: "logoUrl", label: t("logoUrl"), type: "url" as const },
    { name: "isPremium", label: t("premium"), type: "checkbox" as const },
    { name: "isExclusive", label: t("exclusive"), type: "checkbox" as const },
    { name: "isActive", label: t("active"), type: "checkbox" as const },
  ];
  // toValues => fila de la API -> valores del formulario (null => "" para los campos de texto)
  const toValues = (row: Brand) => ({
    name: row.name, description: row.description ?? "", story: row.story ?? "", country: row.country ?? "", website: row.website ?? "",
    logoUrl: row.logoUrl ?? "", isPremium: row.isPremium, isExclusive: row.isExclusive, isActive: row.isActive,
  });
  return (
    <AdminResource<Brand, typeof brandSchema, typeof brandSchema>
      resource="brands"
      path="/brand"
      title={t("title")}
      search="q"
      invalidate={["products"]}
      rowLabel={(row) => row.name}
      columns={[
        {
          key: "name",
          header: t("name"),
          cell: (row) => (
            <span className="flex items-center gap-2">
              {row.logoUrl && <Image src={row.logoUrl} alt="" width={32} height={32} className="size-8 rounded object-contain" />}
              <span className="font-medium">{row.name}</span>
              {row.isPremium && <Badge tone="brand">{t("premium")}</Badge>}
              {row.isExclusive && <Badge tone="info">{t("exclusive")}</Badge>}
            </span>
          ),
        },
        { key: "country", header: t("country"), cell: (row) => row.country ?? "—" },
        { key: "products", header: t("products"), cell: (row) => row.productCount, className: "text-right tabular-nums" },
        { key: "active", header: t("active"), cell: (row) => (row.isActive ? "✓" : "—") },
      ]}
      {...(isAdmin
        ? {
            create: { schema: brandSchema, fields, initialValues: { name: "", description: "", story: "", country: "", website: "", logoUrl: "", isPremium: false, isExclusive: false, isActive: true } },
            edit: { schema: brandSchema, fields, toValues },
            remove: true,
            actions: (row: Brand) => (
              <DialogButton icon="chart" label={`${t("stats")} ${row.name}`} title={t("statsTitle", { name: row.name })}>
                {() => <BrandStatsView brand={row} />}
              </DialogButton>
            ),
          }
        : {})}
    />
  );
}
