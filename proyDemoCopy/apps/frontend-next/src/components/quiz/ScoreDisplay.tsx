import { BicepsFlexed, PartyPopper, ThumbsUp, Trophy } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
// [ScoreDisplay]: muestra puntaje final con accuracy | [Patron]: Presentational | [Principio]: SRP

export interface ScoreDisplayProps {
  points: number;
  correctCount: number;
  totalQuestions: number;
}

export function ScoreDisplay({ points, correctCount, totalQuestions }: ScoreDisplayProps) {
  const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const tier =
    accuracy === 100
      ? { label: "PERFECTO", Icon: Trophy, color: "text-warning" }
      : accuracy >= 75
        ? { label: "Excelente", Icon: PartyPopper, color: "text-success" }
        : accuracy >= 50
          ? { label: "Bien hecho", Icon: ThumbsUp, color: "text-primary" }
          : { label: "Sigue practicando", Icon: BicepsFlexed, color: "text-muted-foreground" };

  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
      <tier.Icon aria-hidden className={`mx-auto size-14 ${tier.color}`} />
      <h2 className={`text-2xl font-extrabold ${tier.color}`}>{tier.label}</h2>
      <div className="text-5xl font-extrabold text-gradient-brand tabular-nums">
        {Math.round(points)}
      </div>
      <p className="text-sm text-muted-foreground">
        Aciertos: <b className="text-foreground">{correctCount}/{totalQuestions}</b>
        {" · "}
        Precision: <b className="text-foreground">{Math.round(accuracy)}%</b>
      </p>
    </section>
  );
}
