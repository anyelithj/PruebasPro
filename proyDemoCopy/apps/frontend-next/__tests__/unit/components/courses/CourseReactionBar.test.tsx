// [Test CourseReactionBar · Caso F · 2026-11-13]: ⭐ 👍 ❤️ — estados, accesibilidad (aria-pressed + nombre con conteo), excluyentes, reversión ante error y login sin sesión
// [Patrón]: Test Double (la red del Facade se simula) | [Tecnología]: Jest + React Testing Library (jsdom)
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@aula/shared-i18n";
import { CourseReactionBar } from "@/components/courses/CourseReactionBar";
import { loginUrlFor, nextReaction, useCourseEngagement, withReaction } from "@/hooks/useCourses";
import type { CourseEngagement } from "@/types/courses";

const saveFavorite = jest.fn();
const saveReaction = jest.fn();
// `jest.mock` (Jest): sustituye el Facade de red; AuthRequiredError real para que `instanceof` funcione
jest.mock("@/store/api/coursesApi", () => {
  const actual = jest.requireActual("@/store/api/coursesApi");
  return { ...actual, saveFavorite: (...a: unknown[]) => saveFavorite(...a), saveReaction: (...a: unknown[]) => saveReaction(...a) };
});
const refresh = jest.fn(); // [2026-11-16]: tras guardar se refrescan los datos del servidor (RSC)
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh }) }));
jest.mock("@/components/layout/PreferencesProvider", () => ({ usePreferences: () => ({ t: getDictionary("es") }) }));

const EMPTY: CourseEngagement = { isFavorite: false, reaction: null, likesCount: 3, lovesCount: 1 };
const btn = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  saveFavorite.mockReset();
  saveReaction.mockReset();
});

describe("reductores puros", () => {
  it("like ↔ love se excluyen y los conteos se ajustan", () => {
    expect(nextReaction("like", "like")).toBeNull(); // Pulsar la activa la quita
    expect(nextReaction("like", "love")).toBe("love"); // La otra la reemplaza
    expect(withReaction({ ...EMPTY, reaction: "like" }, "love")).toEqual({ isFavorite: false, reaction: "love", likesCount: 2, lovesCount: 2 });
  });
});

describe("<CourseReactionBar>", () => {
  it("accesible: tres botones con aria-pressed, conteos en el nombre y el significado en el título", () => {
    render(<CourseReactionBar courseId="c1" initial={{ ...EMPTY, isFavorite: true }} />);
    expect(btn(/^Favorito$/)).toHaveAttribute("aria-pressed", "true");
    expect(btn(/Me gusta \(3\)/)).toHaveAttribute("aria-pressed", "false");
    expect(btn(/Me encanta \(1\)/)).toHaveAttribute("title", "Valoración máxima: te encantó");
    expect(screen.getByRole("group", { name: "Guardar y valorar el curso" })).toBeInTheDocument();
  });

  it("❤️ tras 👍: optimista, reemplaza la reacción y adopta la respuesta del servidor", async () => {
    saveReaction.mockResolvedValue({ isFavorite: false, reaction: "love", likesCount: 2, lovesCount: 5 }); // Otros usuarios también reaccionaron
    render(<CourseReactionBar courseId="c1" initial={{ ...EMPTY, reaction: "like" }} />);
    fireEvent.click(btn(/Me encanta/));
    expect(btn(/Me encanta \(2\)/)).toHaveAttribute("aria-pressed", "true"); // Optimista antes de la red
    expect(btn(/Me gusta \(2\)/)).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(btn(/Me encanta \(5\)/)).toBeInTheDocument()); // Estado real del servidor
    expect(saveReaction).toHaveBeenCalledWith("c1", "love");
    expect(refresh).toHaveBeenCalled(); // «Mis favoritos» y el catálogo no quedan con un estado viejo
  });

  it("⭐ independiente de la reacción y reversión si el backend falla", async () => {
    saveFavorite.mockRejectedValue(new Error("500"));
    render(<CourseReactionBar courseId="c1" initial={{ ...EMPTY, reaction: "love" }} />);
    fireEvent.click(btn(/^Favorito$/));
    expect(btn(/^Favorito$/)).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(btn(/^Favorito$/)).toHaveAttribute("aria-pressed", "false")); // Rollback
    expect(btn(/Me encanta/)).toHaveAttribute("aria-pressed", "true"); // La reacción no se tocó
    expect(saveFavorite).toHaveBeenCalledWith("c1", true);
  });
});

it("sin sesión (401): revierte y pide iniciar sesión volviendo a la misma card", async () => {
  const { AuthRequiredError } = jest.requireActual("@/store/api/coursesApi");
  saveFavorite.mockRejectedValue(new AuthRequiredError());
  const onAuthRequired = jest.fn();
  const { result } = renderHook(() => useCourseEngagement("c9", EMPTY, onAuthRequired));
  act(() => result.current.toggleFavorite());
  await waitFor(() => expect(onAuthRequired).toHaveBeenCalledWith("c9"));
  expect(result.current.state.isFavorite).toBe(false);
  expect(loginUrlFor("c9", "/courses?page=2")).toBe("/login?from=%2Fcourses%3Fpage%3D2%23course-c9"); // Vuelve a la misma card
});

// [Fix 2026-11-14]: NestJS responde { statusCode, data, meta } → el Facade debe devolver `data` (antes el sobre se guardaba como estado y ⭐ 👍 ❤️ se apagaban)
describe("coursesApi.send", () => {
  it("desenvuelve el sobre del TransformInterceptor", async () => {
    const real = jest.requireActual("@/store/api/coursesApi");
    const engagement: CourseEngagement = { isFavorite: true, reaction: "love", likesCount: 2, lovesCount: 7 };
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ statusCode: 200, data: engagement, meta: {} }) })) as never;
    await expect(real.saveFavorite("c1", true)).resolves.toEqual(engagement);
    await expect(real.saveReaction("c1", "love")).resolves.toEqual(engagement);
  });
});
