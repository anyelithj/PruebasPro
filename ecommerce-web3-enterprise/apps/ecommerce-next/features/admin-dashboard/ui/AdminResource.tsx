// AdminResource.tsx (Client Components: React + TanStack Query + Formik/Zod) => bloque CRUD genérico del panel admin.
// Cada recurso (proveedores, cupones, campañas, webhooks...) solo DECLARA columnas, filtros y campos; este archivo pone
// el listado paginado, la búsqueda con debounce, el diálogo crear/editar, el borrado con confirmación y los avisos.
// Patrones: Template Method (estructura fija, piezas variables por props), Strategy (render de cada tipo de campo:
// tabla FIELD_RENDERERS), Command (MutationRequest describe la petición) y Composite (columnas/campos como datos).
// Paradigma: declarativo + funcional (props inmutables). Principios: DRY (≈15 recursos con un solo componente),
// OCP (un tipo de campo nuevo = una entrada en FIELD_RENDERERS), SRP (los datos viven en dashboard.api).
// Ahorro: debounce de 400 ms (menos peticiones) y solo se monta el formulario cuando el diálogo está abierto.
// UX: crear, ver y editar usan el MISMO formulario (mismos campos, mismo orden, mismo diálogo): "ver" lo muestra en solo
// lectura con un botón "Editar"; "editar" muestra bloqueados los campos que no se pueden cambiar. Las acciones de cada
// fila son íconos de ancho fijo (IconAction) con el texto para lectores de pantalla y como tooltip.
"use client"; // Directiva de Next.js: este módulo usa estado y eventos => se ejecuta en el navegador

// "import type" (TypeScript) => importa solo tipos: no agrega bytes al bundle de JavaScript
import { useState, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl"; // next-intl: textos en el idioma activo
import { getIn } from "formik"; // Formik: lee valores anidados ("variants.0.sku") de forma segura
import type { z } from "zod";
import { useAdminList, useAdminMutation, type MutationRequest, type Query } from "../api/dashboard.api";
import { DataTable, type Column } from "./DataTable";
import { SearchField, SelectField, TextAreaField } from "./AdminFields";
import { ResourceDetail } from "./ResourceDetail";
import { NavIcon } from "./AdminSidebar"; // Íconos del manifiesto compartido con Nuxt (mismo trazo en las dos apps)
import { Link } from "@/shared/lib/i18n/navigation"; // Link de next-intl (conserva el prefijo de idioma)
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { cn } from "@/shared/lib/cn";
import { toast } from "@/shared/ui/Toast";
import { useZodForm } from "@/shared/hook/useZodForm";
import { useDebounce } from "@/shared/hook/useDebounce";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";

// ---------- Tipos (TypeScript) ----------

// "export type" => alias reutilizable por todas las secciones
export type Option = { value: string; label: string };

// FormSchema => el mismo tipo de schema que acepta useZodForm (derivado: si cambia el hook, cambia aquí; DRY)
type FormSchema = Parameters<typeof useZodForm>[0]["schema"];
// FormApi => objeto que devuelve useZodForm (valores, errores, getFieldProps...) para un schema cualquiera
type FormApi = ReturnType<typeof useZodForm<FormSchema>>;

// FieldDef => descripción declarativa de un campo del formulario ("interface" => contrato de forma)
export interface FieldDef {
  name: string; // Clave en los valores del formulario (igual a la del schema Zod)
  label: string; // Texto visible y nombre accesible
  // Unión de literales => solo se admiten estos tipos (error de compilación con cualquier otro)
  type?: "text" | "email" | "number" | "url" | "date" | "datetime-local" | "select" | "textarea" | "checkbox" | "checkboxes";
  options?: ReadonlyArray<Option>; // Para "select" y "checkboxes"
  hint?: string; // Ayuda bajo el campo (aria-describedby)
}

// FormConfig<S> => genérico: schema + campos + valores iniciales del MISMO schema (tipado de punta a punta)
export interface FormConfig<S extends FormSchema> {
  schema: S;
  fields: FieldDef[];
  initialValues: z.input<S>;
}

// ---------- Formulario declarativo ----------

// FIELD_RENDERERS => Strategy: cada tipo de campo sabe dibujarse; "Record<K, V>" obliga a cubrir todos los tipos
const FIELD_RENDERERS: Record<NonNullable<FieldDef["type"]>, (field: FieldDef, form: FormApi) => ReactNode> = {
  // "{...form.getFieldProps(name)}" => name/value/onChange/onBlur conectados a Formik en una línea
  select: (field, form) => <SelectField label={field.label} options={field.options ?? []} error={form.error(field.name)} {...form.getFieldProps(field.name)} />,
  textarea: (field, form) => <TextAreaField label={field.label} hint={field.hint} error={form.error(field.name)} {...form.getFieldProps(field.name)} />,
  // checkbox => booleano: "checked" en lugar de "value" (control nativo: accesible sin JavaScript extra)
  checkbox: (field, form) => (
    <label className="flex min-h-9 items-center gap-2 text-sm">
      <input type="checkbox" className="size-4" checked={Boolean(getIn(form.values, field.name))} onChange={(event) => void form.setFieldValue(field.name, event.target.checked)} />
      {field.label}
    </label>
  ),
  // checkboxes => selección múltiple (arreglo de strings) agrupada en <fieldset> + <legend> (WCAG 1.3.1)
  checkboxes: (field, form) => {
    const selected: string[] = getIn(form.values, field.name) ?? []; // "??" => valor por defecto si es undefined/null
    const toggle = (value: string) => void form.setFieldValue(field.name, selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
    const error = form.error(field.name);
    return (
      <fieldset className="flex flex-col gap-2" aria-invalid={error ? true : undefined}>
        <legend className="mb-1 text-sm font-medium">{field.label}</legend>
        <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
          {(field.options ?? []).map((option) => (
            <label key={option.value} className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </fieldset>
    );
  },
  // Los tipos nativos de <input> comparten el mismo control (DRY): el navegador aporta teclado y selector de fecha
  text: (field, form) => <NativeInput field={field} form={form} />,
  email: (field, form) => <NativeInput field={field} form={form} />,
  number: (field, form) => <NativeInput field={field} form={form} />,
  url: (field, form) => <NativeInput field={field} form={form} />,
  date: (field, form) => <NativeInput field={field} form={form} />,
  "datetime-local": (field, form) => <NativeInput field={field} form={form} />,
};

// NativeInput => <input> accesible de shared/ui (label, error traducido, aria-invalid)
function NativeInput({ field, form }: { field: FieldDef; form: FormApi }) {
  return <Input label={field.label} type={field.type ?? "text"} hint={field.hint} error={form.error(field.name)} {...form.getFieldProps(field.name)} />;
}

// WIDE => tipos que ocupan las dos columnas de la grilla (texto largo y listas de casillas)
const WIDE = new Set<FieldDef["type"]>(["textarea", "checkboxes"]);
const cellClass = (field: FieldDef) => (WIDE.has(field.type) ? "sm:col-span-2" : undefined);

// FIELDSET => grilla de 2 columnas; "items-start" alinea por arriba inputs y selects con o sin ayuda/error.
// "[&_:disabled]:..." (variante arbitraria de Tailwind) => los controles bloqueados se leen bien (sin opacidad 50 %)
const FIELDSET = "grid grid-cols-1 items-start gap-4 empty:hidden sm:grid-cols-2 [&_:disabled]:cursor-default [&_:disabled]:bg-muted/40 [&_:disabled]:!opacity-100";

// LockedField => campo que existe al crear pero no se puede editar (email, código, identidad del permiso...):
// se muestra con el MISMO control, deshabilitado, para que crear/ver/editar tengan exactamente la misma forma.
export interface LockedField {
  field: FieldDef;
  value: unknown;
}

// lockedText => valor guardado -> texto visible (Strategy mínima por tipo de campo)
function lockedText({ field, value }: LockedField): string {
  if (value === null || value === undefined || value === "") return "—";
  const label = (item: unknown) => field.options?.find((option) => option.value === String(item))?.label ?? String(item);
  if (Array.isArray(value)) return value.map(label).join(", ");
  if (field.type === "date") return String(value).slice(0, 10); // ISO -> AAAA-MM-DD
  if (field.type === "datetime-local") return String(value).slice(0, 16).replace("T", " ");
  return field.type === "select" ? label(value) : String(value);
}

// LockedControl => mismo aspecto que los controles editables, pero deshabilitado (no viaja en el envío)
function LockedControl({ locked }: { locked: LockedField }) {
  const { field } = locked;
  if (field.type === "checkbox") {
    return (
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={Boolean(locked.value)} disabled readOnly />
        {field.label}
      </label>
    );
  }
  if (WIDE.has(field.type)) return <TextAreaField label={field.label} value={lockedText(locked)} disabled readOnly />;
  return <Input label={field.label} value={lockedText(locked)} disabled readOnly />;
}

interface ResourceFormProps<S extends FormSchema> extends FormConfig<S> {
  submitLabel: string;
  onSubmit: (values: z.output<S>) => Promise<unknown>; // Recibe los valores YA transformados por Zod
  locked?: LockedField[]; // Campos visibles pero no editables (van primero, como en el formulario de creación)
  readOnly?: boolean; // true => "Ver detalle": todos los campos deshabilitados y sin botón de envío
  footer?: ReactNode; // Acciones extra junto al envío (ej. "Editar" en modo lectura)
  aside?: ReactNode; // Datos que genera el sistema (fechas, totales, sub-tablas): bloqueados, antes de los textos largos
}

// ResourceForm => formulario completo a partir de la configuración (Formik + Zod vía useZodForm).
// Grilla de 2 columnas en pantallas medianas (1 en móvil); <fieldset disabled> => modo lectura nativo (sin JS extra).
// "[&_:disabled]:..." (variante arbitraria de Tailwind) => los controles bloqueados se leen bien (sin opacidad 50 %).
export function ResourceForm<S extends FormSchema>({ schema, fields, initialValues, submitLabel, onSubmit, locked = [], readOnly = false, footer, aside }: ResourceFormProps<S>) {
  const form = useZodForm({ schema, initialValues, onSubmit: (values) => onSubmit(values) });
  // Orden fijo en crear/ver/editar: campos cortos -> datos del sistema (aside) -> textos largos y casillas al final
  const cells = [
    ...locked.map((item) => ({ field: item.field, node: <LockedControl locked={item} /> })),
    ...fields.map((field) => ({ field, node: FIELD_RENDERERS[field.type ?? "text"](field, form as unknown as FormApi) })),
  ];
  const grid = (wide: boolean) =>
    cells.filter((cell) => WIDE.has(cell.field.type) === wide).map((cell) => (
      <div key={cell.field.name} className={cellClass(cell.field)}>
        {cell.node}
      </div>
    ));
  return (
    // "noValidate" => sin burbujas nativas del navegador: los errores los muestra Zod de forma accesible y traducida
    <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-4">
      <fieldset disabled={readOnly} className={FIELDSET}>{grid(false)}</fieldset>
      {aside}
      <fieldset disabled={readOnly} className={FIELDSET}>{grid(true)}</fieldset>
      {(footer || !readOnly) && (
        <div className="flex flex-wrap justify-end gap-2">
          {footer}
          {!readOnly && (
            <Button type="submit" loading={form.isSubmitting}>
              {submitLabel}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

// ---------- Acción de fila con ícono ----------

// IconAction => botón (o enlace con "href") de 36×36 solo con ícono: todas las acciones de la tabla miden lo mismo.
// El texto queda para lectores de pantalla (sr-only) y como tooltip nativo (title). Patrón Decorator sobre Button.
// Mismo diseño en TODAS las filas: borde gris sin relleno de color ("variant" se acepta por compatibilidad y se ignora);
// eliminar solo tiñe el ícono al pasar el mouse. Deshabilitado => visible pero atenuado (todas las filas iguales).
type IconActionProps = { icon: string; label: string; href?: string; variant?: "secondary" | "primary" | "dangerOutline" } & Omit<ComponentProps<typeof Button>, "children" | "size" | "variant" | "asChild">;
export function IconAction({ icon, label, href, className, ...rest }: IconActionProps) {
  const content = (
    <>
      <NavIcon name={icon} />
      <span className="sr-only">{label}</span>
    </>
  );
  // "asChild" (Radix Slot) => con href el estilo se aplica al <Link> (sin anidar <a> dentro de <button>)
  return href ? (
    <Button asChild size="icon" variant="secondary" title={label} className={className}>
      <Link href={href}>{content}</Link>
    </Button>
  ) : (
    <Button size="icon" {...rest} variant="secondary" title={label} className={cn(icon === "delete" && "hover:text-red-700", className)}>
      {content}
    </Button>
  );
}

// ---------- Mutaciones con avisos (hook reutilizable) ----------

// useAdminCommand => ejecuta un MutationRequest, muestra el aviso de éxito/error e invalida SOLO los recursos dados.
// Devuelve una función async que nunca rechaza (los formularios no quedan con promesas sin capturar).
export function useAdminCommand(resources: string[]) {
  const t = useTranslations("admin.common");
  const errorMessage = useErrorMessage();
  // Identidad: la entrada YA es la petición (Command); el hook genérico se encarga del token y la invalidación
  const mutation = useAdminMutation<MutationRequest>(resources, (request) => request);
  const run = async (request: MutationRequest, success = t("saved")): Promise<boolean> => {
    try {
      await mutation.mutateAsync(request);
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(errorMessage(error)); // Mensaje traducido por código de error del backend
      return false;
    }
  };
  return { run, isPending: mutation.isPending };
}

// ---------- Recurso CRUD completo ----------

// "interface ... <T, C, E>" => genéricos: T = fila del listado, C/E = schemas de crear/editar
interface AdminResourceProps<T, C extends FormSchema, E extends FormSchema> {
  resource: string; // Clave de caché ["admin", resource]
  path: string; // Endpoint REST del listado (ej. "/supplier")
  title: string; // Título de la sección y nombre accesible de la tabla
  columns: Column<T>[];
  rowKey?: (row: T) => string; // Por defecto "row.id"
  rowLabel?: (row: T) => string; // Nombre de la fila para lectores de pantalla ("Editar Acme S.A.")
  search?: string; // Parámetro de búsqueda del backend ("q", "to", "action"); sin valor => sin buscador
  filters?: Array<{ name: string; label: string; options: Option[] }>; // Selects con opción "Todos"
  query?: Query; // Parámetros fijos del listado
  baseUrl?: string; // Otro backend con el mismo contrato (FastAPI)
  invalidate?: string[]; // Otros recursos que cambian con estas mutaciones (ej. inventario -> KPIs)
  create?: FormConfig<C> & { toBody?: (values: z.output<C>) => unknown };
  edit?: Omit<FormConfig<E>, "initialValues"> & { toValues: (row: T) => z.input<E>; toBody?: (values: z.output<E>, row: T) => unknown; path?: (row: T) => string; when?: (row: T) => boolean };
  remove?: boolean | ((row: T) => boolean); // true => botón eliminar (DELETE path/:id)
  actions?: (row: T, run: ReturnType<typeof useAdminCommand>["run"]) => ReactNode; // Acciones extra por fila
  toolbar?: ReactNode; // Botones extra junto a "Nuevo [nombre]"
  empty?: string;
  detail?: boolean; // false => sin botón "Ver" (la sección ya tiene su propia vista de detalle)
  // RF-04.3 selección múltiple: con "bulk" aparece una casilla por fila y una barra con las acciones del lote.
  // Render prop: recibe los IDs elegidos y "clear" para vaciar la selección tras aplicar la acción
  bulk?: (ids: string[], clear: () => void) => ReactNode;
}

// PAGE_SIZE => filas por página en TODAS las tablas del panel (uniforme)
export const PAGE_SIZE = 10;

// Dialog => estado del diálogo: cerrado (null), crear ({}), ver ({ row, view: true }) o editar ({ row })
type Dialog<T> = { row?: T; view?: boolean } | null;

// useNewLabel => texto ESTÁNDAR del botón de creación: "Nuevo cliente", "Nueva factura"... (admin.new.<recurso>).
// El género gramatical vive en la traducción: por eso hay una clave por recurso en lugar de "Nuevo {nombre}"
export function useNewLabel(resource: string) {
  const tNew = useTranslations("admin.new");
  const t = useTranslations("admin.common");
  return tNew.has(resource) ? tNew(resource) : t("new");
}

export function AdminResource<T, C extends FormSchema = FormSchema, E extends FormSchema = FormSchema>(props: AdminResourceProps<T, C, E>) {
  const { resource, path, title, columns, search, filters = [], query = {}, baseUrl, create, edit, remove, actions, toolbar, empty, detail = true, bulk } = props;
  const t = useTranslations("admin.common");
  const newLabel = useNewLabel(resource);
  // "as" => aserción: por convención todos los recursos del backend exponen "id"
  const rowKey = props.rowKey ?? ((row: T) => (row as { id: string }).id);
  const rowLabel = props.rowLabel ?? rowKey;

  // Estado local de la vista (useState: no se comparte con otras pantallas => no va a Redux)
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<Dialog<T>>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set()); // IDs elegidos para acciones en lote
  const debounced = useDebounce(term, 400); // Espera a que el usuario deje de escribir

  // Spread condicional: el parámetro de búsqueda solo viaja si hay buscador y texto
  const list = useAdminList<T>(resource, path, { page, limit: PAGE_SIZE, ...query, ...values, ...(search ? { [search]: debounced } : {}) }, baseUrl);
  const command = useAdminCommand([resource, ...(props.invalidate ?? [])]);
  const withBase = (request: MutationRequest): MutationRequest => (baseUrl ? { ...request, baseUrl } : request);
  const idPath = (row: T) => `${path}/${encodeURIComponent(rowKey(row))}`; // encodeURIComponent: IDs con "/" (Cloudinary)

  // onFilter => cambia un filtro y vuelve a la página 1 (la página 3 de otro filtro podría no existir)
  const onFilter = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  const onDelete = async (row: T) => {
    // "window.confirm" => diálogo nativo del navegador: accesible por teclado y lector de pantalla, 0 KB de JS extra
    if (!window.confirm(t("confirmDelete", { name: rowLabel(row) }))) return;
    await command.run(withBase({ path: idPath(row), method: "DELETE" }), t("deleted"));
  };

  // Columna de acciones: "Ver" en TODAS las filas + editar, eliminar y acciones propias del módulo
  const canRemove = (row: T) => (typeof remove === "function" ? remove(row) : Boolean(remove));
  const canEdit = (row: T) => Boolean(edit) && (edit?.when?.(row) ?? true);

  // Formulario ÚNICO: los campos de creación marcan el orden; los que no se editan se muestran bloqueados
  const editNames = new Set(edit?.fields.map((field) => field.name));
  const lockedOf = (row: T): LockedField[] =>
    (create?.fields ?? []).filter((field) => !editNames.has(field.name)).map((field) => ({ field, value: getIn(row, field.name) }));
  // toggle => agrega/quita un ID (Set inmutable: se crea uno nuevo para que React detecte el cambio)
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const pageIds = (list.data?.data ?? []).map(rowKey);
  const selectColumn: Column<T>[] = bulk
    ? [{
        key: "__select",
        header: t("select"),
        className: "w-px",
        cell: (row) => <input type="checkbox" className="size-4 cursor-pointer" aria-label={`${t("select")} ${rowLabel(row)}`} checked={selected.has(rowKey(row))} onChange={() => toggle(rowKey(row))} />,
      }]
    : [];
  const allColumns: Column<T>[] =
    detail || edit || remove || actions
      ? [
          ...selectColumn,
          ...columns,
          {
            key: "__actions",
            header: t("actions"),
            className: "w-px text-right", // "w-px" => la columna mide solo lo que ocupan sus íconos
            cell: (row) => (
              // Íconos de ancho fijo (36 px) con borde: se reconocen como botones y la columna no cambia de ancho
              <div className="flex justify-end gap-1.5">
                {detail && <IconAction icon="view" label={`${t("view")} ${rowLabel(row)}`} onClick={() => setDialog({ row, view: true })} />}
                {actions?.(row, command.run)}
                {/* Editar/eliminar en TODAS las filas: si el registro no lo permite, el botón queda deshabilitado */}
                {edit && <IconAction icon="edit" disabled={!canEdit(row)} label={`${t("edit")} ${rowLabel(row)}`} onClick={() => setDialog({ row })} />}
                {remove && <IconAction icon="delete" disabled={!canRemove(row)} label={`${t("delete")} ${rowLabel(row)}`} onClick={() => void onDelete(row)} />}
              </div>
            ),
          },
        ]
      : [...selectColumn, ...columns];

  // detailOf => resto del registro (fechas, totales, sub-tablas) que genera el sistema: bloqueado en ver Y en editar
  const detailOf = (row: T) => <ResourceDetail resource={resource} row={row} columns={columns} exclude={[...(create?.fields ?? []), ...(edit?.fields ?? [])].map((field) => field.name)} />;

  // submit => crea (POST path) o edita (PATCH path/:id); cierra el diálogo solo si salió bien
  const submit = async (request: MutationRequest) => {
    if (await command.run(withBase(request))) setDialog(null);
  };

  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          {search && <SearchField label={t("search")} value={term} onChange={(value) => (setTerm(value), setPage(1))} />}
          {filters.map((filter) => (
            <SelectField key={filter.name} label={filter.label} value={values[filter.name] ?? ""} onChange={(event) => onFilter(filter.name, event.target.value)} options={[{ value: "", label: t("all") }, ...filter.options]} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {toolbar}
          {create && <Button onClick={() => setDialog({})}>{t("new")}</Button>}
        </div>
      </div>

      {/* Barra de lote: aparece con la selección; aria-live anuncia cuántos hay elegidos */}
      {bulk && (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set([...selected, ...pageIds]))} disabled={pageIds.length === 0}>{t("selectPage")}</Button>
          {selected.size > 0 && (
            <>
              <span className="font-medium">{t("selected", { count: selected.size })}</span>
              {bulk([...selected], () => setSelected(new Set()))}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t("clearSelection")}</Button>
            </>
          )}
        </div>
      )}

      <DataTable caption={title} columns={allColumns} rows={list.data?.data} rowKey={rowKey} loading={list.isFetching} meta={list.data?.meta} onPage={setPage} {...(empty ? { empty } : {})} />

      {/* El formulario solo existe con el diálogo abierto (no se crean estados Formik ocultos) */}
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        wide // Mismo ancho para crear, ver y editar (el formulario es el mismo)
        // Título: "Detalle: X", "Editar: X" o el mismo texto del botón de creación ("Nueva factura")
        title={dialog?.row ? t(dialog.view ? "viewTitle" : "editTitle", { name: rowLabel(dialog.row) }) : newLabel}
      >
        {dialog?.row ? (
          <div className="flex flex-col gap-6">
            {edit ? (
              // Ver y editar = el MISMO ResourceForm; "readOnly" decide si se puede escribir
              <ResourceForm
                key={dialog.view ? "view" : "edit"} // Al pasar de "ver" a "editar" Formik arranca limpio
                schema={edit.schema}
                fields={edit.fields}
                locked={lockedOf(dialog.row)}
                initialValues={edit.toValues(dialog.row)}
                readOnly={Boolean(dialog.view)}
                submitLabel={t("save")}
                aside={detailOf(dialog.row)}
                footer={dialog.view && canEdit(dialog.row) ? <Button variant="secondary" onClick={() => setDialog({ row: dialog.row as T })}>{t("edit")}</Button> : undefined}
                onSubmit={(formValues) => submit({ path: edit.path ? edit.path(dialog.row as T) : idPath(dialog.row as T), method: "PATCH", body: edit.toBody ? edit.toBody(formValues, dialog.row as T) : formValues })}
              />
            ) : create ? (
              // Sin edición => el formulario de creación en solo lectura con los datos guardados
              <ResourceForm schema={create.schema} fields={[]} locked={lockedOf(dialog.row)} initialValues={create.initialValues} readOnly submitLabel="" onSubmit={async () => undefined} aside={detailOf(dialog.row)} />
            ) : (
              detailOf(dialog.row)
            )}
          </div>
        ) : create ? (
          <ResourceForm schema={create.schema} fields={create.fields} initialValues={create.initialValues} submitLabel={t("create")} onSubmit={(formValues) => submit({ path, method: "POST", body: create.toBody ? create.toBody(formValues) : formValues })} />
        ) : null}
      </Modal>
    </section>
  );
}

// ---------- Acciones con diálogo (detalle o formulario propio) ----------

// DialogButton => botón que abre un diálogo; el contenido es una FUNCIÓN (render prop) que solo se ejecuta abierto
// (lazy: las consultas del detalle no se disparan hasta que el usuario lo pide) y recibe "close" para cerrarse
// "size" => "sm" en filas de tabla (por defecto) y "md" en la barra superior (misma altura que "Nuevo [nombre]")
// "icon" => en filas de tabla se dibuja como IconAction (solo ícono, ancho uniforme); el texto pasa a sr-only + tooltip
// "disabled" => la acción se ve en todas las filas, pero bloqueada donde no aplica
export function DialogButton({ label, title, icon, variant = "secondary", size = "sm", disabled, children }: { label: string; title: string; icon?: string; variant?: "ghost" | "secondary" | "primary"; size?: "sm" | "md"; disabled?: boolean | undefined; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {icon ? (
        <IconAction icon={icon} label={label} disabled={disabled} onClick={() => setOpen(true)} />
      ) : (
        <Button size={size} variant={variant} disabled={disabled} onClick={() => setOpen(true)}>
          {label}
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {open && children(() => setOpen(false))}
      </Modal>
    </>
  );
}

// FormAction => DialogButton + ResourceForm + comando: acciones como "registrar movimiento" o "enviar correo"
interface FormActionProps<S extends FormSchema> extends FormConfig<S> {
  label: string;
  icon?: string; // Clave del ícono => acción de fila de ancho fijo
  title: string;
  resources: string[]; // Recursos a invalidar al terminar
  toRequest: (values: z.output<S>) => MutationRequest;
  submitLabel?: string;
  success?: string;
  variant?: "ghost" | "secondary" | "primary";
  disabled?: boolean | undefined;
}

export function FormAction<S extends FormSchema>({ label, icon, title, resources, toRequest, submitLabel, success, variant, disabled, ...form }: FormActionProps<S>) {
  const t = useTranslations("admin.common");
  const command = useAdminCommand(resources);
  return (
    <DialogButton label={label} title={title} disabled={disabled} {...(icon ? { icon } : {})} {...(variant ? { variant } : {})}>
      {(close) => <ResourceForm {...form} submitLabel={submitLabel ?? t("save")} onSubmit={async (values) => (await command.run(toRequest(values), success)) && close()} />}
    </DialogButton>
  );
}

// ---------- Utilidades de presentación compartidas ----------

// toOptions => ["A", "B"] -> [{ value: "A", label: t("A") }] (Factory de opciones traducidas; DRY en todas las secciones)
export function toOptions(values: readonly string[], label: (value: string) => string = (value) => value): Option[] {
  return values.map((value) => ({ value, label: label(value) }));
}

// isoOrUndefined => "2026-10-05T10:00" (hora local del navegador) -> ISO UTC que entiende el backend
export const isoOrUndefined = (value: string | undefined) => (value ? new Date(value).toISOString() : undefined);
