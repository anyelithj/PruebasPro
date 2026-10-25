import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

// [Functional E2E · Feedback IA]
// REQUISITOS: app levantada (frontend + backend + ai-service).
//
// [Auto-seed]: crea quiz vía API (docente), completa una sesión vía API (estudiante,
// con una respuesta correcta y una incorrecta) y luego verifica que la página
// /feedback muestre el análisis + detalle por pregunta. Borra el quiz al final.

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000/api/v1";
const TEACHER = { email: "docente@neuroedu.ia", password: "StrongP@ss123" };
const STUDENT = { email: "estudiante@neuroedu.ia", password: "StrongP@ss123" };

const QUIZ_TITLE_TEXT = "E2E Feedback IA (auto-seed)";

let quizId: string;
let teacherToken: string;

async function apiLogin(
  api: APIRequestContext,
  creds: { email: string; password: string },
): Promise<string> {
  const res = await api.post(`${BACKEND_URL}/auth/login`, { data: creds });
  expect(res.ok(), `login ${creds.email} debe responder 2xx`).toBeTruthy();
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

test.beforeAll(async () => {
  const api = await playwrightRequest.newContext();

  // 1. Docente crea quiz publicado con 2 preguntas de respuesta conocida
  teacherToken = await apiLogin(api, TEACHER);
  const createRes = await api.post(`${BACKEND_URL}/quiz`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      title: QUIZ_TITLE_TEXT,
      description: "Quiz creado automáticamente por ai-feedback.spec.ts",
      category: "general",
      difficulty: "easy",
      isPublished: true,
      timePerQuestionSeconds: 60,
      questions: [
        {
          text: "¿Cuánto es 3 + 3?",
          type: "multiple_choice",
          options: ["6", "5", "7", "33"],
          correctAnswer: "6",
          difficulty: "easy",
          feedback: "Recuerda sumar unidad por unidad.",
          explanation: "3 + 3 = 6 por definición de la suma.",
        },
        {
          text: "La Tierra es plana.",
          type: "true_false",
          options: ["true", "false"],
          correctAnswer: "false",
          difficulty: "easy",
          feedback: "Revisa el concepto de geodesia básica.",
          explanation: "La Tierra es un esferoide oblato.",
        },
      ],
    },
  });
  expect(createRes.ok(), "creación del quiz seed debe responder 2xx").toBeTruthy();
  const created = (await createRes.json()) as {
    data: { id: string; questions: Array<{ id: string }> };
  };
  quizId = created.data.id;
  const [q1, q2] = created.data.questions;

  // 2. Estudiante completa la sesión vía API: una correcta + una incorrecta
  const studentToken = await apiLogin(api, STUDENT);
  const auth = { Authorization: `Bearer ${studentToken}` };

  const sessionRes = await api.post(`${BACKEND_URL}/quiz/${quizId}/session`, {
    headers: auth,
    data: {},
  });
  expect(sessionRes.ok(), "inicio de sesión de quiz debe responder 2xx").toBeTruthy();
  const session = (await sessionRes.json()) as { data: { id: string } };
  const sessionId = session.data.id;

  const a1 = await api.post(`${BACKEND_URL}/quiz/session/${sessionId}/answer`, {
    headers: auth,
    data: { questionId: q1.id, userAnswer: "6", timeTakenMs: 4000 },
  });
  expect(a1.ok(), "respuesta 1 debe responder 2xx").toBeTruthy();

  const a2 = await api.post(`${BACKEND_URL}/quiz/session/${sessionId}/answer`, {
    headers: auth,
    data: { questionId: q2.id, userAnswer: "true", timeTakenMs: 4000 },
  });
  expect(a2.ok(), "respuesta 2 debe responder 2xx").toBeTruthy();

  const endRes = await api.post(`${BACKEND_URL}/quiz/session/${sessionId}/end`, {
    headers: auth,
    data: {},
  });
  expect(endRes.ok(), "cierre de sesión de quiz debe responder 2xx").toBeTruthy();

  await api.dispose();
});

// [Cleanup]: borra el quiz seed (las sesiones asociadas se limpian por cascade o quedan
// huérfanas sin afectar otros tests)
test.afterAll(async () => {
  if (!quizId || !teacherToken) return;
  const api = await playwrightRequest.newContext();
  await api
    .delete(`${BACKEND_URL}/quiz/${quizId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    })
    .catch(() => undefined);
  await api.dispose();
});

test.describe("Feedback IA · Estudiante", () => {
  // [Sesión limpia]: el storageState global loguea como ADMIN; este flujo necesita
  // el historial del ESTUDIANTE → login explícito por UI
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo electrónico/i).fill(STUDENT.email);
    // [Locator por rol]: getByLabel(/contraseña/i) colisiona con el botón "Mostrar contraseña"
    await page.getByRole("textbox", { name: /^contraseña$/i }).fill(STUDENT.password);
    // [Exact]: sin exact colisiona con "Iniciar sesión con Google/Microsoft"
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  test("muestra el análisis IA y el detalle por pregunta del examen completado", async ({
    page,
  }) => {
    await page.goto("/feedback");

    // 1. Página de feedback cargada
    await expect(
      page.getByRole("heading", { name: /feedback generado por ia/i }),
    ).toBeVisible();

    // 2. Tarjeta del examen seed con su análisis cognitivo
    const card = page
      .locator("article")
      .filter({ hasText: QUIZ_TITLE_TEXT })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/análisis cognitivo/i)).toBeVisible();
    // [Resultado conocido]: 1/2 correctas → 50 puntos de precisión
    await expect(card.getByText(/1 incorrecta/i)).toBeVisible();

    // 3. Detalle por pregunta (acordeón <details>)
    await card.getByText(/ver detalle por pregunta/i).click();
    await expect(card.getByRole("table")).toBeVisible();
    // La incorrecta muestra el feedback pedagógico sembrado
    await expect(card.getByText(/revisa el concepto de geodesia/i)).toBeVisible();
    // Respuestas del estudiante visibles en la tabla — "6" aparece 2 veces
    // (tu respuesta + correcta, son la misma) → contamos en vez de visible-único
    await expect(card.getByRole("cell", { name: "6", exact: true })).toHaveCount(2);
  });
});
