// [FilterSelect]: <select> de filtro con etiqueta visible para los formularios GET de Gestión (Recursos y Actividades) | [Patrón]: Presentational Component | [Principio]: DRY
// [Tecnología]: React Server Component sin estado → el formulario funciona sin JavaScript (GET nativo, URL compartible) | [A11y]: <label htmlFor> asociada

export function FilterSelect({ name, label, value, all, options }: { name: string; label: string; value?: string; all: string; options: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <div className="min-w-36 flex-1">
      <label htmlFor={`f-${name}`} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className="control w-full">
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
