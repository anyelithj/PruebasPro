export type ChartBar = { label: string; height: number; value?: number | string };

// [ChartBars]: barras simples con títulos de eje posicionados sobre los ejes (Y rotado a la izquierda, X centrado abajo) | [Patrón]: Presentational | [Principio]: SRP + Clarity
export function ChartBars({
  bars,
  yLabel,
  xLabel,
}: {
  bars: ChartBar[];
  yLabel?: string;
  xLabel?: string;
}) {
  return (
    <div>
      <div className="flex items-stretch gap-2">
        {yLabel && (
          <span
            className="text-[11px] font-medium text-muted-foreground"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {yLabel}
          </span>
        )}
        <div className="flex-1 flex items-end gap-3 h-52 px-1 pt-2 pb-7">
          {bars.map((b) => (
            <div
              key={b.label}
              style={{ height: `${b.height}%` }}
              className="flex-1 min-h-2 rounded-t-lg bg-gradient-brand relative transition-opacity hover:opacity-85"
            >
              {b.value !== undefined && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground font-semibold">
                  {b.value}
                </span>
              )}
              <small className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">
                {b.label}
              </small>
            </div>
          ))}
        </div>
      </div>
      {xLabel && (
        <p className="mt-1 text-center text-[11px] font-medium text-muted-foreground">
          {xLabel}
        </p>
      )}
    </div>
  );
}
