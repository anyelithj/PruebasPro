"use client";
import { useEffect } from "react";
import { useTimer } from "@/hooks/useTimer";
import { cn } from "@/lib/utils";
// [TimerBar]: barra horizontal con countdown visual + onExpire | [Patron]: Composite + Container | [Principio]: SRP | [Paradigma]: Reactivo

export interface TimerBarProps {
  seconds: number;
  onExpire: () => void;
  isPaused?: boolean;
  className?: string;
}

export function TimerBar({ seconds, onExpire, isPaused, className }: TimerBarProps) {
  const { timeLeft, pause: doPause, start } = useTimer({
    initialSeconds: seconds,
    onExpire,
    autoStart: true,
  });

  useEffect(() => {
    if (isPaused) doPause();
    else start();
  }, [isPaused, doPause, start]);

  const percent = Math.max(0, Math.min(100, (timeLeft / seconds) * 100));
  const colorClass =
    percent > 50 ? "bg-success" : percent > 20 ? "bg-warning" : "bg-danger";

  return (
    <div className={cn("w-full", className)} role="timer" aria-live="off">
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="font-semibold tabular-nums">{Math.ceil(timeLeft)}s</span>
        <span className="text-xs text-muted-foreground">
          {percent > 50 ? "Tiempo de sobra" : percent > 20 ? "Apresurate" : "Ultimos segundos"}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all duration-200", colorClass)}
          style={{ width: `${percent}%` }}
          aria-valuenow={Math.ceil(timeLeft)}
          aria-valuemax={seconds}
          aria-valuemin={0}
          role="progressbar"
        />
      </div>
    </div>
  );
}
