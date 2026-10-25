// ProductsAdmin.tsx (Client Components) => catálogo admin: listado con búsqueda y estado (borrador/activo/archivado)
// y formulario de producto (crear/editar) con variantes, categoría, marca e imágenes subidas a Cloudinary.
// Patrones: Composite (variantes como lista dinámica), Adapter (toBody: valores del formulario -> contrato de Express),
// Observer (al guardar se invalidan solo ["admin","products"]; Express revalida el ISR de la tienda por su cuenta).
// Rendimiento: el formulario solo existe en /dashboard/products/new y /[id]/edit (code splitting por ruta).
"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { FieldArray, FormikProvider } from "formik"; // FieldArray (Formik): agregar/quitar filas de variantes
import { useAdminGet } from "../api/dashboard.api";
import { AdminResource, toOptions, useAdminCommand, IconAction, DialogButton } from "./AdminResource";
import { MarkdownPlanner } from "./GrowthAdmin"; // RF-18.10
import { AdminTabs } from "./AdminTabs";
import { BrandsTab, BulkEditButton, ExportButtons, ImportButton } from "./CatalogTools"; // RF-04.3 / RF-05
import { SelectField, TextAreaField } from "./AdminFields";
import { StatusBadge } from "./OrdersAdmin";
import { PRODUCT_BADGES, productSchema, type ProductFormValues, type ProductPayload } from "../lib/dashboard.validator";
import { Badge } from "@/shared/ui/Badge";
import type { CategoryNode, ProductCard, ProductDetail, Brand } from "@/entities/product/model/product.types";
import { MediaUploader } from "@/features/media/ui/MediaUploader";
import { useZodForm } from "@/shared/hook/useZodForm";
import { useFormat } from "@/shared/hook/useFormat";
import { Link, useRouter } from "@/shared/lib/i18n/navigation";
import { routes } from "@/shared/constants/routes";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";

const STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
type ProductStatus = (typeof STATUSES)[number]; // Tipo indexado: "DRAFT" | "ACTIVE" | "ARCHIVED" (derivado, DRY)

// TRANSITIONS => máquina de estados del ciclo editorial (State pattern declarativo): cada botón pasa de "from" a "to".
// Borrador -> Publicar; Publicado -> Pasar a borrador / Archivar; Archivado -> Restaurar. TODAS las filas muestran los
// 4 botones (columna uniforme); los que no aplican al estado actual quedan deshabilitados.
// Express vuelve a validar el estado (UpdateProductSchema) y degrada a borrador si no quedan variantes activas.
const TRANSITIONS: ReadonlyArray<{ from: ProductStatus; to: ProductStatus; key: "publish" | "unpublish" | "archive" | "restore"; icon: string }> = [
  { from: "DRAFT", to: "ACTIVE", key: "publish", icon: "check" },
  { from: "ACTIVE", to: "DRAFT", key: "unpublish", icon: "undo" },
  { from: "ACTIVE", to: "ARCHIVED", key: "archive", icon: "archive" },
  { from: "ARCHIVED", to: "DRAFT", key: "restore", icon: "refresh" },
];

// ---------- Sección con pestañas: Productos | Marcas ----------
export function ProductsAdmin() {
  const t = useTranslations("admin.products");
  return (
    <AdminTabs
      section="products"
      label={t("tabs.label")}
      tabs={[
        { id: "products", label: t("tabs.products"), render: () => <ProductsTab /> },
        { id: "brands", label: t("tabs.brands"), render: () => <BrandsTab /> },
      ]}
    />
  );
}

// ---------- Listado ----------
function ProductsTab() {
  const t = useTranslations("admin.products");
  const format = useFormat();
  const statusOptions = toOptions(STATUSES, (value) => t(`statuses.${value}`));
  const tc = useTranslations("admin.common"); // Botón de creación: "Nuevo" (mismo texto estándar en todas las secciones)
  return (
    <AdminResource<ProductCard>
      resource="products"
      path="/product"
      title={t("title")}
      search="q"
      rowLabel={(row) => row.name}
      filters={[
        { name: "status", label: t("status"), options: statusOptions },
        { name: "badge", label: t("badges"), options: toOptions(PRODUCT_BADGES, (value) => t(`badge.${value}`)) }, // RF-04.2
      ]}
      // RF-04.3: exportar/importar Excel-CSV y edición en lote de los productos seleccionados
      toolbar={
        <>
          <ExportButtons />
          <ImportButton />
          <Button asChild>
            <Link href={routes.adminProductNew}>{tc("new")}</Link>
          </Button>
        </>
      }
      bulk={(ids, clear) => <BulkEditButton ids={ids} clear={clear} />}
      columns={[
        {
          key: "name",
          header: t("name"),
          cell: (row) => (
            <span className="flex items-center gap-2">
              {row.imageUrl && <Image src={row.imageUrl} alt="" width={40} height={40} className="size-10 rounded object-cover" />}
              <span className="font-medium">{row.name}</span>
              {/* RF-04.2 insignias comerciales (texto visible: no depende solo del color) */}
              {row.badges.map((badge) => <Badge key={badge} tone={badge === "SALE" ? "danger" : badge === "NEW" ? "info" : "success"}>{t(`badge.${badge}`)}</Badge>)}
            </span>
          ),
        },
        { key: "status", header: t("status"), cell: (row) => <StatusBadge status={row.status === "ACTIVE" ? "DELIVERED" : row.status === "ARCHIVED" ? "CANCELLED" : "PENDING"} label={t(`statuses.${row.status}`)} /> },
        { key: "category", header: t("category"), cell: (row) => row.category?.name ?? "—" },
        { key: "price", header: t("price"), cell: (row) => format.money(row.minPriceCents, row.currency), className: "text-right" },
        { key: "stock", header: t("stock"), cell: (row) => (row.inStock ? t("inStock") : t("outOfStock")) },
      ]}
      // "run" (Command) => PATCH solo con el estado; el aviso confirma la transición y se invalida el listado
      actions={(row, run) => (
        <>
          {TRANSITIONS.map((transition) => (
            <IconAction key={transition.key} icon={transition.icon} disabled={row.status !== transition.from} label={`${t(transition.key)} ${row.name}`} onClick={() => void run({ path: `/product/${row.id}`, method: "PATCH", body: { status: transition.to } }, t(`transitionDone.${transition.key}`))} />
          ))}
          <IconAction icon="edit" label={`${t("edit")} ${row.name}`} href={routes.adminProductEdit(row.id)} />
          {/* RF-04.3 duplicar: copia como borrador con SKUs nuevos y stock 0 */}
          <IconAction icon="layers" label={`${t("duplicate")} ${row.name}`} onClick={() => void run({ path: `/product/${row.id}/duplicate`, method: "POST" }, t("duplicated"))} />
          {/* RF-18.10 calendario de rebajas óptimo (FastAPI: elasticidad + balance ingresos/utilidad) */}
          <DialogButton icon="tag" label={`${t("markdown")} ${row.name}`} title={`${t("markdown")} · ${row.name}`}>
            {() => <MarkdownPlanner productId={row.id} />}
          </DialogButton>
        </>
      )}
      remove
    />
  );
}

// ---------- Formulario (crear / editar) ----------

// ProductForm => sin "productId" crea; con "productId" carga el producto y edita
export function ProductForm({ productId }: { productId?: string }) {
  const product = useAdminGet<ProductDetail>("products", productId ? `/product/${productId}` : null);
  if (productId && !product.data) return <Skeleton className="h-96 w-full" />;
  return <ProductFormBody product={product.data} />;
}

// toFormValues => producto del backend -> valores del formulario (precios en pesos, nulos -> "")
const toFormValues = (product?: ProductDetail): ProductFormValues => ({
  name: product?.name ?? "",
  description: product?.description ?? "",
  status: (product?.status as ProductFormValues["status"] | undefined) ?? "DRAFT",
  categoryId: product?.category?.id ?? "",
  brandId: product?.brand?.id ?? "",
  badges: product?.badges ?? [],
  preSaleUntil: product?.preSaleUntil?.slice(0, 10) ?? "",
  variants: product?.variants.map((variant) => ({ sku: variant.sku, name: variant.name, price: variant.priceCents / 100, stock: variant.available })) ?? [{ sku: "", name: "", price: 0, stock: 0 }],
  images: product?.images.map((image) => ({ url: image.url, publicId: image.publicId, alt: image.alt, ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}) })) ?? [],
});

// flatten => árbol de categorías -> opciones con sangría visual ("— Hijo") para el <select>
const flatten = (nodes: CategoryNode[], depth = 0): Array<{ value: string; label: string }> =>
  nodes.flatMap((node) => [{ value: node.id, label: `${"— ".repeat(depth)}${node.name}` }, ...flatten(node.children, depth + 1)]);

function ProductFormBody({ product }: { product?: ProductDetail | undefined }) {
  const t = useTranslations("admin.products");
  const router = useRouter();
  const command = useAdminCommand(["products", "inventory"]);
  const categories = useAdminGet<CategoryNode[]>("categories", "/category");
  const brands = useAdminGet<Brand[]>("brands", "/brand");
  const originalSkus = new Set(product?.variants.map((variant) => variant.sku) ?? []); // SKUs que ya existen

  // toBody => Adapter al contrato de Express (CreateProductSchema / UpdateProductSchema)
  const toBody = (values: ProductPayload) => ({
    name: values.name,
    description: values.description,
    // Un producto nuevo no nace archivado (Express solo acepta DRAFT/ACTIVE al crear)
    status: !product && values.status === "ARCHIVED" ? "DRAFT" : values.status,
    categoryId: values.categoryId ?? null, // null => quitar la categoría al editar
    brandId: values.brandId ?? null,
    badges: values.badges, // RF-04.2
    preSaleUntil: values.preSaleUntil ? new Date(`${values.preSaleUntil}T23:59:59`).toISOString() : null, // RF-14.4
    // El stock de variantes existentes se ajusta en Inventario (con historial); aquí solo el de variantes nuevas
    variants: values.variants.map((variant) => ({ sku: variant.sku, name: variant.name, priceCents: variant.price, ...(originalSkus.has(variant.sku) ? {} : { stock: variant.stock }) })),
    ...(product ? { removeVariantSkus: [...originalSkus].filter((sku) => !values.variants.some((variant) => variant.sku === sku)) } : {}),
    images: values.images,
  });

  const form = useZodForm({
    schema: productSchema,
    initialValues: toFormValues(product),
    onSubmit: async (values) => {
      const ok = await command.run(product ? { path: `/product/${product.id}`, method: "PATCH", body: toBody(values) } : { path: "/product", method: "POST", body: toBody(values) });
      if (ok) router.push(routes.adminProducts);
    },
  });

  return (
    // FormikProvider => contexto para FieldArray (mismo objeto "form" de useZodForm)
    <FormikProvider value={form}>
      <form noValidate onSubmit={form.handleSubmit} className="flex max-w-3xl flex-col gap-6">
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="sr-only">{t("general")}</legend>
          <div className="sm:col-span-2">
            <Input label={t("name")} error={form.error("name")} {...form.getFieldProps("name")} />
          </div>
          <SelectField label={t("status")} options={toOptions(STATUSES, (value) => t(`statuses.${value}`))} {...form.getFieldProps("status")} />
          <SelectField label={t("category")} options={[{ value: "", label: "—" }, ...flatten(categories.data ?? [])]} {...form.getFieldProps("categoryId")} />
          <SelectField label={t("brand")} options={[{ value: "", label: "—" }, ...(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name }))]} {...form.getFieldProps("brandId")} />
          {/* RF-14.4 preventa: hasta esta fecha solo compran los niveles Diamante y Platino */}
          <Input label={t("preSaleUntil")} type="date" {...form.getFieldProps("preSaleUntil")} />
          {/* RF-04.2 insignias: casillas nativas dentro de un fieldset con leyenda (grupo accesible) */}
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="text-sm font-medium">{t("badges")}</legend>
            <div className="flex flex-wrap gap-4">
              {PRODUCT_BADGES.map((badge) => {
                const badges = form.values.badges ?? [];
                return (
                  <label key={badge} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4" checked={badges.includes(badge)} onChange={() => void form.setFieldValue("badges", badges.includes(badge) ? badges.filter((item) => item !== badge) : [...badges, badge])} />
                    {t(`badge.${badge}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </fieldset>

        {/* Variantes: lista dinámica (FieldArray). Cada fila en su <fieldset> con leyenda para lectores de pantalla */}
        <FieldArray name="variants">
          {(helpers) => (
            <section aria-labelledby="variants-title" className="flex flex-col gap-3">
              <h2 id="variants-title" className="text-base font-semibold">
                {t("variants")}
              </h2>
              {form.values.variants.map((variant, index) => (
                <fieldset key={index} className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_120px_100px_auto] sm:items-end">
                  <legend className="sr-only">{t("variantN", { n: index + 1 })}</legend>
                  <Input label={t("sku")} error={form.error(`variants.${index}.sku`)} {...form.getFieldProps(`variants.${index}.sku`)} />
                  <Input label={t("variantName")} error={form.error(`variants.${index}.name`)} {...form.getFieldProps(`variants.${index}.name`)} />
                  <Input label={t("price")} type="number" min={0} step="0.01" error={form.error(`variants.${index}.price`)} {...form.getFieldProps(`variants.${index}.price`)} />
                  <Input
                    label={t("stock")}
                    type="number"
                    min={0}
                    disabled={originalSkus.has(variant.sku)} // Stock existente => módulo Inventario (historial de movimientos)
                    hint={originalSkus.has(variant.sku) ? t("stockHint") : undefined}
                    error={form.error(`variants.${index}.stock`)}
                    {...form.getFieldProps(`variants.${index}.stock`)}
                  />
                  <IconAction icon="delete" variant="dangerOutline" className="self-end" label={t("removeVariant")} disabled={form.values.variants.length === 1} onClick={() => helpers.remove(index)} />
                </fieldset>
              ))}
              <Button variant="secondary" size="sm" className="self-start" onClick={() => helpers.push({ sku: "", name: "", price: 0, stock: 0 })}>
                {t("addVariant")}
              </Button>
            </section>
          )}
        </FieldArray>

        {/* Imágenes: se suben a Cloudinary (carpeta products) y cada una exige texto alternativo */}
        <FieldArray name="images">
          {(helpers) => (
            <section aria-labelledby="images-title" className="flex flex-col gap-3">
              <h2 id="images-title" className="text-base font-semibold">
                {t("images")}
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {form.values.images.map((image, index) => (
                  <li key={image.publicId} className="flex gap-3 rounded-lg border p-2">
                    <Image src={image.url} alt="" width={80} height={80} className="size-20 rounded object-cover" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Input label={t("alt")} error={form.error(`images.${index}.alt`)} {...form.getFieldProps(`images.${index}.alt`)} />
                      <IconAction icon="delete" variant="dangerOutline" className="self-end" label={t("removeImage")} onClick={() => helpers.remove(index)} />
                    </div>
                  </li>
                ))}
              </ul>
              <MediaUploader folder="products" onUploaded={(assets) => assets.forEach((asset) => helpers.push({ url: asset.url, publicId: asset.publicId, alt: form.values.name, width: asset.width, height: asset.height }))} />
            </section>
          )}
        </FieldArray>

        {/* Textos largos al final del formulario (mismo orden que el formulario genérico del panel) */}
        <TextAreaField label={t("description")} rows={6} error={form.error("description")} {...form.getFieldProps("description")} />

        <div className="flex gap-2">
          <Button type="submit" loading={form.isSubmitting}>
            {product ? t("save") : t("create")}
          </Button>
          <Button variant="secondary" asChild>
            <Link href={routes.adminProducts}>{t("cancel")}</Link>
          </Button>
        </div>
      </form>
    </FormikProvider>
  );
}
