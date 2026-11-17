"use client";
import { useEffect, useRef, useState } from "react";
// [ExamClock · 2026-11-06]: cuenta atrás del tiempo TOTAL del examen (hora fin del servidor = inicio del intento + minutos) → al llegar a 0 entrega el examen
// [A11y]: el reloj visible no se anuncia cada segundo; solo avisos a los 5 min y 1 min (role=status)

export function ExamClock({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const fired = useRef(false);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, deadline - Date.now());
      setLeft(ms);
      if (ms === 0 && !fired.current) {
        fired.current = true;
        expire.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const min = Math.floor(left / 60_000);
  const sec = Math.floor((left % 60_000) / 1000);
  const low = left <= 5 * 60_000;
  return (
    <div className={`flex items-center justify-between rounded-xl border p-3 ${low ? "border-danger/40 bg-danger/10 text-danger" : "border-border bg-muted"}`}>
      <span className="text-sm font-semibold">Tiempo restante</span>
      <span className="font-mono text-xl font-bold tabular-nums" aria-hidden>
        {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
      </span>
      <span role="status" className="sr-only">
        {left === 0 ? "Se acabó el tiempo" : min < 1 ? "Queda menos de 1 minuto" : low ? "Quedan menos de 5 minutos" : ""}
      </span>
    </div>
  );
}
