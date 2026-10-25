// NewOrderForm.tsx (Client Components · React + Formik/Zod + TanStack Query) => "Nuevo pedido" creado por el ADMIN
// (venta asistida por teléfono/WhatsApp o pruebas del flujo completo sin pagar con Stripe).
// El ADMIN elige cliente (email), productos por SKU (lista del inventario con stock disponible), cantidades, dirección
// y costo de envío; Express (POST /order/manual) toma precios e IVA del catálogo, descuenta stock en una transacción y
// publica "order.placed" (envío, correo y CRM reaccionan igual que con una compra real).
// Patrones: Composite (filas de ítems con FieldArray), Command (MutationRequest), Facade (useAdminCommand: aviso +
// invalidación). Accesibilidad: <fieldset>/<legend> por bloque, label en cada control y errores con role="alert".
"use client"; // Directiva de Next.js: estado de formulario y eventos => navegador

import { useTranslations } from "next-intl";
import { FieldArray, FormikProvider } from "formik"; // FieldArray (Formik): agregar/quitar filas dinámicas
import { useAdminList, type StockLevel } from "../api/dashboard.api";
import { DialogButton, useAdminCommand, useNewLabel } from "./AdminResource";
import { SelectField } from "./AdminFields";
import { manualOrderSchema, type ManualOrderValues } from "../lib/dashboard.validator";
import { useZodForm } from "@/shared/hook/useZodForm";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";

// INITIAL => valores iniciales (Formik necesita todos los campos); país por defecto CO (ISO 3166-1 alfa-2)
const INITIAL: ManualOrderValues = {
  customerEmail: "",
  items: [{ sku: "", quantity: 1 }],
  shippingAddress: { recipientName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "CO" },
  shippingCents: 0,
  note: "",
};

// ADDRESS_FIELDS => campos de la dirección como datos (Composite declarativo: un <Input> por entrada, sin JSX repetido)
const ADDRESS_FIELDS = ["recipientName", "phone", "line1", "line2", "city", "state", "postalCode", "country"] as const;

// NewOrderButton => botón "Nuevo pedido" + diálogo; el formulario solo se monta abierto (DialogButton es lazy)
export function NewOrderButton() {
  const label = useNewLabel("orders"); // Título del diálogo: "Nuevo pedido"
  const tc = useTranslations("admin.common"); // Botón: "Nuevo" (texto estándar)
  return (
    <DialogButton variant="primary" size="md" label={tc("new")} title={label}>
      {(close) => <NewOrderForm onDone={close} />}
    </DialogButton>
  );
}

function NewOrderForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("admin.orders.manual");
  // Variantes con stock (mismo endpoint y caché que Inventario): opciones "SKU · producto (disponibles)"
  const stock = useAdminList<StockLevel>("inventory", "/inventory", { page: 1, limit: 100 });
  const options = [{ value: "", label: t("chooseProduct") }, ...(stock.data?.data ?? []).map((level) => ({ value: level.sku, label: `${level.sku} · ${level.productName} ${level.variantName} (${level.available})` }))];
  // Invalida pedidos, KPIs e inventario: el pedido nuevo aparece en la tabla y el stock baja en Inventario
  const command = useAdminCommand(["orders", "kpi", "inventory"]);

  const form = useZodForm({
    schema: manualOrderSchema,
    initialValues: INITIAL,
    onSubmit: async (values) => {
      if (await command.run({ path: "/order/manual", method: "POST", body: values }, t("created"))) onDone();
    },
  });

  return (
    // FormikProvider => contexto que necesita FieldArray (mismo objeto "form" de useZodForm)
    <FormikProvider value={form}>
      <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-5">
        <Input label={t("customerEmail")} type="email" hint={t("customerHint")} error={form.error("customerEmail")} {...form.getFieldProps("customerEmail")} />

        <FieldArray name="items">
          {(helpers) => (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-semibold">{t("items")}</legend>
              {form.values.items.map((_item, index) => (
                <div key={index} className="grid grid-cols-[1fr_88px] items-end gap-2 sm:grid-cols-[1fr_96px_auto]">
                  <SelectField label={t("product")} options={options} error={form.error(`items.${index}.sku`)} {...form.getFieldProps(`items.${index}.sku`)} />
                  <Input label={t("quantity")} type="number" min={1} error={form.error(`items.${index}.quantity`)} {...form.getFieldProps(`items.${index}.quantity`)} />
                  <Button variant="dangerOutline" size="sm" className="col-span-2 sm:col-span-1 sm:mb-1" disabled={form.values.items.length === 1} onClick={() => helpers.remove(index)}>
                    {t("removeItem")}
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" className="self-start" onClick={() => helpers.push({ sku: "", quantity: 1 })}>
                {t("addItem")}
              </Button>
            </fieldset>
          )}
        </FieldArray>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold">{t("address")}</legend>
          {ADDRESS_FIELDS.map((field) => (
            <Input key={field} label={t(`fields.${field}`)} error={form.error(`shippingAddress.${field}`)} {...form.getFieldProps(`shippingAddress.${field}`)} />
          ))}
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={t("shipping")} type="number" min={0} step="0.01" hint={t("shippingHint")} error={form.error("shippingCents")} {...form.getFieldProps("shippingCents")} />
          <Input label={t("note")} error={form.error("note")} {...form.getFieldProps("note")} />
        </div>

        <p className="text-xs text-slate-500">{t("pricesHint")}</p>
        <Button type="submit" loading={form.isSubmitting} className="self-end">
          {t("submit")}
        </Button>
      </form>
    </FormikProvider>
  );
}
