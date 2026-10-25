"use client";
import { useCallback, useEffect, useRef, useState } from "react";
// [Hook useTimer]: countdown reutilizable | [Patron]: Custom Hook | [Principio]: SRP + DRY | [Paradigma]: Funcional + Reactivo

export interface UseTimerOptions {
  initialSeconds: number;
  // [onExpire]: callback al llegar a 0 | [Patron]: Callback
  onExpire?: () => void;
  // [autoStart]: arranca al montar
  autoStart?: boolean;
  // [tickMs]: granularidad del tick (default 250 para responsive UI)
  tickMs?: number;
}

export interface UseTimerReturn {
  // [timeLeft]: segundos restantes (puede ser fraccional para barra suave)
  timeLeft: number;
  // [isRunning]: estado actual del countdown
  isRunning: boolean;
  // [start / pause / reset]: controles
  start: () => void;
  pause: () => void;
  reset: (newSeconds?: number) => void;
}

export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const { initialSeconds, onExpire, autoStart = true, tickMs = 250 } = options;
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  // [Ref a interval]: evita re-renders innecesarios | [Principio]: KISS
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // [Ref a onExpire]: usa el ultimo callback sin re-suscribir el efecto | [Patron]: Latest-Value Ref
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(
    (newSeconds?: number) => {
      clear();
      setTimeLeft(newSeconds ?? initialSeconds);
      setIsRunning(autoStart);
    },
    [clear, initialSeconds, autoStart],
  );

  // [Efecto tick]: arranca/para intervalo cuando cambia isRunning | [Paradigma]: Reactivo
  useEffect(() => {
    if (!isRunning) {
      clear();
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - tickMs / 1000;
        if (next <= 0) {
          // [Cleanup defensivo]: paramos antes de invocar callback
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsRunning(false);
          onExpireRef.current?.();
          return 0;
        }
        return next;
      });
    }, tickMs);
    return clear;
  }, [isRunning, tickMs, clear]);

  // [Cleanup desmontaje]: evita timers fantasma | [Principio]: defensive
  useEffect(() => clear, [clear]);

  return { timeLeft, isRunning, start, pause, reset };
}
