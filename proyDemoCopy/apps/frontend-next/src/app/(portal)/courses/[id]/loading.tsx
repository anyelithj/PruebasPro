// [Loading skeleton /courses/:id]: placeholder hero + descripción mientras SSR carga | [Patrón]: Skeleton | [Principio]: SRP
export default function CourseDetailLoading() {
  return (
    <div className="py-6 space-y-4" role="status" aria-live="polite" aria-busy="true">
      <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--nl-surf2)" }} />
      <div
        className="rounded-2xl p-5 space-y-3 animate-pulse"
        style={{ background: "var(--nl-surf)", border: "1px solid var(--nl-brd)" }}
      >
        <div className="h-4 w-48 rounded" style={{ background: "var(--nl-surf2)" }} />
        <div className="h-7 w-3/4 rounded" style={{ background: "var(--nl-surf2)" }} />
        <div className="h-4 w-full rounded" style={{ background: "var(--nl-surf2)" }} />
        <div className="h-2 w-full rounded-full" style={{ background: "var(--nl-surf2)" }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5 h-32 animate-pulse"
            style={{ background: "var(--nl-surf)", border: "1px solid var(--nl-brd)" }}
          />
        ))}
      </div>
      <span className="sr-only">Cargando detalle del curso…</span>
    </div>
  );
}
