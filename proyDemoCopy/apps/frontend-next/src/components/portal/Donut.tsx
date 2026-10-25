export function Donut({
  label,
  gradient,
}: {
  label: React.ReactNode;
  gradient?: string;
}) {
  const bg =
    gradient ??
    "conic-gradient(var(--primary) 0 65%, var(--accent) 65% 85%, var(--muted) 85% 100%)";
  return (
    <div
      className="relative mx-auto size-40 rounded-full grid place-items-center"
      style={{ background: bg }}
    >
      <span className="absolute size-28 rounded-full bg-card" />
      <b className="relative z-10 text-2xl">{label}</b>
    </div>
  );
}
