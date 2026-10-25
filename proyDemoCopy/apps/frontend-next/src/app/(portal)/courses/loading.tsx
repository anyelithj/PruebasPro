// [Loading skeleton /courses]: placeholder de carga con grid de cards | [Patrón]: Skeleton + Null Object | [Principio]: SRP
export default function CoursesLoading() {
  return (
    <div className="space-y-5 py-6" role="status" aria-live="polite" aria-busy="true">
      <div className="space-y-2">
        <div
          className="h-8 w-48 rounded animate-pulse"
          style={{ background: "var(--nl-surf2)" }}
        />
        <div
          className="h-4 w-80 rounded animate-pulse"
          style={{ background: "var(--nl-surf2)" }}
        />
      </div>
      <div
        className="rounded-xl p-4 h-28 animate-pulse"
        style={{ background: "var(--nl-surf)", border: "1px solid var(--nl-brd)" }}
      />
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden animate-pulse"
            style={{
              background: "var(--nl-surf)",
              border: "1px solid var(--nl-brd)",
              boxShadow: "var(--nl-shd)",
            }}
          >
            <div className="h-24" style={{ background: "var(--nl-surf2)" }} />
            <div className="p-3.5 space-y-2">
              <div className="h-3 w-16 rounded" style={{ background: "var(--nl-surf2)" }} />
              <div className="h-4 w-full rounded" style={{ background: "var(--nl-surf2)" }} />
              <div className="h-3 w-3/4 rounded" style={{ background: "var(--nl-surf2)" }} />
              <div className="h-12 rounded" style={{ background: "var(--nl-surf2)" }} />
              <div className="h-1.5 rounded-full" style={{ background: "var(--nl-surf2)" }} />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando cursos…</span>
    </div>
  );
}
