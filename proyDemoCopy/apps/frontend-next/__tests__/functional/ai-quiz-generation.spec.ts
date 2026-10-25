import { test, expect, request as playwrightRequest } from "@playwright/test";

// [Functional E2E · Generación de examen con IA]
// REQUISITOS:
// 1. App levantada (frontend + backend + ai-service).
// 2. Ollama corriendo con el modelo configurado en apps/backend/.env
//    (OLLAMA_QWEN_MODEL / OLLAMA_MISTRAL_MODEL).
//
// [Advertencia de duración]: la generación usa un LLM local en CPU — una pregunta
// tarda 30-120s (más en cold start). El timeout del test es generoso a propósito.
//
// Flujo: docente → /quiz/create → panel IA → generar 1 pregunta → crear examen
// → verificar redirección al detalle. El quiz creado se borra al final.

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000/api/v1";
const TEACHER = { email: "docente@neuroedu.ia", password: "StrongP@ss123" };

const QUIZ_TITLE_TEXT = "E2E Examen generado con IA (auto-seed)";

let createdQuizId: string | undefined;

// [Cleanup]: borra el quiz creado por el test para no acumular basura entre corridas
test.afterAll(async () => {
  if (!createdQuizId) return;
  const api = await playwrightRequest.newContext();
  const loginRes = await api.post(`${BACKEND_URL}/auth/login`, { data: TEACHER });
  if (loginRes.ok()) {
    const body = (await loginRes.json()) as { data: { accessToken: string } };
    await api
      .delete(`${BACKEND_URL}/quiz/${createdQuizId}`, {
        headers: { Authorization: `Bearer ${body.data.accessToken}` },
      })
      .catch(() => undefined);
  }
  await api.dispose();
});

test.describe("Generación de examen con IA · Docente", () => {
  // [Sesión limpia]: el storageState global loguea como ADMIN; este flujo es del
  // DOCENTE → login explícito por UI
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo electrónico/i).fill(TEACHER.email);
    // [Locator por rol]: getByLabel(/contraseña/i) colisiona con el botón "Mostrar contraseña"
    await page.getByRole("textbox", { name: /^contraseña$/i }).fill(TEACHER.password);
    // [Exact]: sin exact colisiona con "Iniciar sesión con Google/Microsoft"
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  test("genera una pregunta con IA y crea el examen", async ({ page }) => {
    // [Timeout extendido]: LLM local en CPU — generación 30-120s + posible fallback
    test.setTimeout(480_000);

    await page.goto("/quiz/create");
    await expect(
      page.getByRole("heading", { name: /crear examen/i }),
    ).toBeVisible();

    // 1. Metadatos mínimos del examen
    await page.getByLabel(/título/i).fill(QUIZ_TITLE_TEXT);
    await page.getByLabel(/^categoría/i).selectOption("general");
    await page.getByLabel(/^dificultad/i).selectOption("easy");

    // 2. Abrir panel IA y configurar la generación (1 pregunta = lo más rápido)
    await page
      .getByRole("button", { name: /generar pregunta con ia/i })
      .click();
    await page.getByLabel(/tema/i).fill("La fotosíntesis");
    await page.getByLabel(/cantidad/i).fill("1");
    await page.getByLabel(/tipo de pregunta/i).selectOption("multiple_choice");
    await page.getByLabel(/motor/i).selectOption("qwen");

    // 3. Generar — espera larga (Ollama en CPU; incluye posible fallback de motor)
    await page.getByRole("button", { name: /generar y añadir/i }).click();
    await expect(page.getByRole("status")).toContainText(/se gener(ó|aron)/i, {
      timeout: 420_000,
    });

    // 4. La pregunta generada aparece en el formulario con contenido real
    const questionCard = page.getByRole("article", { name: /pregunta 1/i });
    await expect(questionCard).toBeVisible();
    const questionText = await questionCard
      .getByLabel(/enunciado/i)
      .inputValue();
    expect(questionText.trim().length, "el enunciado generado no debe estar vacío").toBeGreaterThan(10);

    // 5. Crear el examen y verificar redirección al detalle /quiz/<uuid>
    await page.getByRole("button", { name: /crear examen/i }).click();
    await expect(page).toHaveURL(
      /\/quiz\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      { timeout: 30_000 },
    );
    createdQuizId = page.url().split("/").pop();

    // 6. El detalle muestra el título del examen recién creado
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      new RegExp(QUIZ_TITLE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
  });
});
