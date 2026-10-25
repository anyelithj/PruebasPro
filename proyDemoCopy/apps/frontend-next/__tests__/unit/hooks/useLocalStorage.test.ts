// [Test useLocalStorage]: lectura/escritura, sincronización entre pestañas y borrado
import { act, renderHook } from "@testing-library/react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const KEY = "qa:useLocalStorage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("usa el valor inicial cuando no existe la clave", () => {
    const { result } = renderHook(() => useLocalStorage(KEY, "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("rehidrata desde localStorage si la clave ya existe", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ n: 7 }));
    const { result } = renderHook(() => useLocalStorage(KEY, { n: 0 }));
    expect(result.current[0]).toEqual({ n: 7 });
  });

  it("persiste valores directos en localStorage", () => {
    const { result } = renderHook(() => useLocalStorage(KEY, 0));
    act(() => result.current[1](42));
    expect(result.current[0]).toBe(42);
    expect(JSON.parse(window.localStorage.getItem(KEY) as string)).toBe(42);
  });

  it("admite función updater (prev) => next", () => {
    const { result } = renderHook(() => useLocalStorage<number>(KEY, 10));
    act(() => result.current[1]((prev) => prev + 5));
    expect(result.current[0]).toBe(15);
  });

  it("remove() vuelve al valor inicial y limpia la clave", () => {
    const { result } = renderHook(() => useLocalStorage(KEY, "init"));
    act(() => result.current[1]("changed"));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    act(() => result.current[2]());
    expect(result.current[0]).toBe("init");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("reacciona a `storage` event (cambio en otra pestaña)", () => {
    const { result } = renderHook(() => useLocalStorage(KEY, "old"));
    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify("from-other-tab"));
      window.dispatchEvent(
        new StorageEvent("storage", { key: KEY, newValue: JSON.stringify("from-other-tab") }),
      );
    });
    expect(result.current[0]).toBe("from-other-tab");
  });

  it("fallback al inicial cuando el JSON almacenado es inválido", () => {
    window.localStorage.setItem(KEY, "{not-json");
    const { result } = renderHook(() => useLocalStorage(KEY, "safe"));
    expect(result.current[0]).toBe("safe");
  });
});
