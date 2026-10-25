// [Test useDebounce]: hook de debounce — diferir actualización hasta tras `delayMs`
// [Estrategia]: timers falsos de Jest para avanzar tiempo determinístico | [Patrón]: AAA
import { act, renderHook } from "@testing-library/react";
import { useDebounce } from "@/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("retorna el valor inicial sincrónicamente", () => {
    const { result } = renderHook(() => useDebounce("foo", 200));
    expect(result.current).toBe("foo");
  });

  it("no actualiza antes de cumplirse el delay", () => {
    const { result, rerender } = renderHook(({ v, d }) => useDebounce(v, d), {
      initialProps: { v: "a", d: 300 },
    });

    rerender({ v: "b", d: 300 });

    // [< delay]: aún no commitea el nuevo valor
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");
  });

  it("emite el último valor tras vencer el delay", () => {
    const { result, rerender } = renderHook(({ v, d }) => useDebounce(v, d), {
      initialProps: { v: "a", d: 300 },
    });

    rerender({ v: "b", d: 300 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("b");
  });

  it("reinicia el timer en cada cambio (sólo persiste el último valor)", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    rerender({ v: "c" });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    // [no debió commitear "b"]: el segundo cambio reseteó el timer
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current).toBe("c");
  });
});
