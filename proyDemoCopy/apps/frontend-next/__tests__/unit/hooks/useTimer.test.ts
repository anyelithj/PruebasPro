// [Test useTimer]: countdown con fake timers | [Patrón]: Hook Test | [Principio]: Determinista
import { renderHook, act } from "@testing-library/react";
import { useTimer } from "@/hooks/useTimer";

describe("useTimer", () => {
  // [fake timers]: control total del reloj para ser determinista
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("inicializa con initialSeconds y autoStart por defecto", () => {
    const { result } = renderHook(() => useTimer({ initialSeconds: 10 }));
    expect(result.current.timeLeft).toBe(10);
    expect(result.current.isRunning).toBe(true);
  });

  it("decrementa timeLeft según los ticks", () => {
    const { result } = renderHook(() => useTimer({ initialSeconds: 10, tickMs: 1000 }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.timeLeft).toBeCloseTo(9);
  });

  it("invoca onExpire y se detiene al llegar a 0", () => {
    const onExpire = jest.fn();
    const { result } = renderHook(() =>
      useTimer({ initialSeconds: 2, tickMs: 1000, onExpire }),
    );
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.timeLeft).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it("pause detiene el conteo y start lo reanuda", () => {
    const { result } = renderHook(() => useTimer({ initialSeconds: 10, tickMs: 1000 }));
    act(() => result.current.pause());
    expect(result.current.isRunning).toBe(false);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBe(10); // [sin avance al estar en pausa]
    act(() => result.current.start());
    expect(result.current.isRunning).toBe(true);
  });

  it("reset restablece timeLeft (con o sin nuevo valor)", () => {
    const { result } = renderHook(() => useTimer({ initialSeconds: 10, tickMs: 1000 }));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    act(() => result.current.reset());
    expect(result.current.timeLeft).toBe(10);
    act(() => result.current.reset(5));
    expect(result.current.timeLeft).toBe(5);
  });

  it("respeta autoStart=false (no arranca solo)", () => {
    const { result } = renderHook(() =>
      useTimer({ initialSeconds: 10, autoStart: false, tickMs: 1000 }),
    );
    expect(result.current.isRunning).toBe(false);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.timeLeft).toBe(10);
  });
});
