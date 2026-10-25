// EmailDesigner.tsx (Client Component · React + HTML5 Drag & Drop nativo + Tailwind) => RF-21.6 diseñador visual de
// correos: paleta de bloques (arrastrar o pulsar "Agregar"), lienzo reordenable (arrastrar o flechas), editor del
// bloque seleccionado y vista previa REAL (la genera Express con el mismo render del envío: sin duplicar lógica).
// Personalización: cualquier texto admite {{ firstName }} y otras variables.
// Patrones: Composite (bloques) + Command (agregar/mover/eliminar) + Observer (vista previa con debounce).
// Accesibilidad: todo lo que se arrastra también se hace con teclado (botones), lista con aria-label, iframe con title.
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAdminMutation, type EmailBlock } from "../api/dashboard.api";
export type { EmailBlock };
import { useAdminCommand } from "./AdminResource";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";

// PRESETS => bloque nuevo de cada tipo con contenido de ejemplo (biblioteca de bloques)
const PRESETS: Record<EmailBlock["type"], EmailBlock> = {
  heading: { type: "heading", text: "¡Hola {{ firstName }}!", align: "left" },
  text: { type: "text", text: "Tenemos novedades para ti." },
  image: { type: "image", src: "https://res.cloudinary.com/demo/image/upload/sample.jpg", alt: "Imagen" },
  button: { type: "button", label: "Comprar ahora", href: "https://", color: "#0f172a" },
  product: { type: "product", name: "Producto", price: "$ 99.000", imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg", href: "https://" },
  divider: { type: "divider" },
  spacer: { type: "spacer", height: 16 },
};
const TYPES = Object.keys(PRESETS) as Array<EmailBlock["type"]>;
const SAMPLE = { firstName: "Ana", lastName: "Gómez" }; // Variables de ejemplo de la vista previa

interface Props {
  template?: { id: string; name: string; subject: string; blocks: EmailBlock[] | null } | undefined;
  onDone: () => void;
}

export function EmailDesigner({ template, onDone }: Props) {
  const t = useTranslations("admin.marketing.designer");
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [blocks, setBlocks] = useState<EmailBlock[]>(template?.blocks ?? [PRESETS.heading, PRESETS.text, PRESETS.button]);
  const [selected, setSelected] = useState<number | null>(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [html, setHtml] = useState("");
  const preview = useAdminMutation<EmailBlock[], { html: string }>([], (body) => ({ path: "/email/template/preview", method: "POST", body: { blocks: body, variables: SAMPLE } }));
  const { run, isPending } = useAdminCommand(["templates"]);

  // Vista previa con debounce de 500 ms: no se pide al servidor en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      if (blocks.length) preview.mutate(blocks, { onSuccess: (data) => setHtml(data.html) });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- "preview" cambia de identidad en cada render
  }, [blocks]);

  const add = (type: EmailBlock["type"], at = blocks.length) => {
    setBlocks((current) => [...current.slice(0, at), { ...PRESETS[type] }, ...current.slice(at)]);
    setSelected(at);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    setBlocks((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setSelected(to);
  };
  const update = (patch: Partial<EmailBlock>) => setBlocks((current) => current.map((block, i) => (i === selected ? ({ ...block, ...patch } as EmailBlock) : block)));
  const remove = (index: number) => {
    setBlocks((current) => current.filter((_, i) => i !== index));
    setSelected(null);
  };

  const save = async () => {
    const body = { name, subject, blocks };
    const ok = await run(template ? { path: `/email/template/${template.id}`, method: "PATCH", body } : { path: "/email/template", method: "POST", body }, t("saved"));
    if (ok) onDone();
  };
  const block = selected !== null ? blocks[selected] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">{t("name")}<input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-md border px-2" /></label>
        <label className="flex flex-col gap-1 text-sm">{t("subject")}<input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 rounded-md border px-2" /></label>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr_1fr]">
        {/* Paleta: arrastrar al lienzo o pulsar para agregar al final */}
        <ul aria-label={t("palette")} className="flex flex-row flex-wrap gap-2 lg:flex-col">
          {TYPES.map((type) => (
            <li key={type}>
              <button type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/block-type", type)} onClick={() => add(type)} className="w-full cursor-grab rounded-md border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50">
                ＋ {t(`types.${type}`)}
              </button>
            </li>
          ))}
        </ul>
        {/* Lienzo: soltar bloques nuevos o reordenar los existentes */}
        <ol
          aria-label={t("canvas")}
          className="flex min-h-64 flex-col gap-2 rounded-lg border-2 border-dashed p-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const type = e.dataTransfer.getData("text/block-type") as EmailBlock["type"];
            if (type) add(type);
          }}
        >
          {blocks.map((item, index) => (
            <li
              key={index}
              draggable
              onDragStart={() => setDragFrom(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation();
                const type = e.dataTransfer.getData("text/block-type") as EmailBlock["type"];
                if (type) add(type, index);
                else if (dragFrom !== null) move(dragFrom, index);
                setDragFrom(null);
              }}
              className={cn("flex items-center gap-2 rounded-md border bg-white p-2 text-sm", selected === index && "ring-2 ring-slate-900")}
            >
              <button type="button" className="flex-1 truncate text-left" onClick={() => setSelected(index)} aria-pressed={selected === index}>
                <span className="font-medium">{t(`types.${item.type}`)}</span>
                <span className="ml-2 text-slate-500">{"text" in item ? item.text : "label" in item ? item.label : "name" in item ? item.name : ""}</span>
              </button>
              <button type="button" aria-label={t("up")} onClick={() => move(index, index - 1)} className="px-1">↑</button>
              <button type="button" aria-label={t("down")} onClick={() => move(index, index + 1)} className="px-1">↓</button>
              <button type="button" aria-label={t("remove")} onClick={() => remove(index)} className="px-1 text-red-600">✕</button>
            </li>
          ))}
        </ol>
        {/* Editor del bloque seleccionado + vista previa */}
        <div className="flex flex-col gap-3">
          {block && <BlockEditor block={block} onChange={update} />}
          <iframe title={t("preview")} srcDoc={html} className="h-96 w-full rounded-lg border bg-white" sandbox="" />
        </div>
      </div>
      <p className="text-xs text-slate-500">{t("variablesHint")}</p>
      <Button onClick={() => void save()} loading={isPending} disabled={!name.trim() || !subject.trim() || blocks.length === 0} className="self-start">{t("save")}</Button>
    </div>
  );
}

// BlockEditor => campos del tipo de bloque (Strategy por "type": cada tipo edita solo lo suyo)
function BlockEditor({ block, onChange }: { block: EmailBlock; onChange: (patch: Partial<EmailBlock>) => void }) {
  const t = useTranslations("admin.marketing.designer");
  const field = (key: string, value: string | number, type = "text") => (
    <label key={key} className="flex flex-col gap-1 text-sm">
      {t(`fields.${key}`)}
      {key === "text" && block.type === "text" ? (
        <textarea value={String(value)} rows={4} onChange={(e) => onChange({ [key]: e.target.value } as Partial<EmailBlock>)} className="rounded-md border p-2" />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange({ [key]: type === "number" ? Number(e.target.value) : e.target.value } as Partial<EmailBlock>)} className="h-9 rounded-md border px-2" />
      )}
    </label>
  );
  // Object.entries => cada propiedad editable del bloque (menos "type"); "align" es un selector
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{t(`types.${block.type}`)}</legend>
      {Object.entries(block)
        .filter(([key]) => key !== "type")
        .map(([key, value]) =>
          key === "align" ? (
            <label key={key} className="flex flex-col gap-1 text-sm">
              {t("fields.align")}
              <select value={String(value)} onChange={(e) => onChange({ align: e.target.value as "left" | "center" })} className="h-9 rounded-md border px-2">
                <option value="left">{t("left")}</option>
                <option value="center">{t("center")}</option>
              </select>
            </label>
          ) : (
            field(key, value as string | number, key === "height" ? "number" : key === "color" ? "color" : "text")
          )
        )}
      {block.type === "image" && !("href" in block && block.href) && (
        <button type="button" className="self-start text-xs underline" onClick={() => onChange({ href: "https://" })}>{t("addLink")}</button>
      )}
    </fieldset>
  );
}
