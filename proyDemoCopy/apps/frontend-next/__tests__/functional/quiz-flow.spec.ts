import { test, expect, request as playwrightRequest } from "@playwright/test";

// [Functional E2E · Quiz Flow]
// REQUISITOS:
// 1. App levantada (frontend + backend + ai-service).
// 2. Sesión manejada por storageState (global-setup) — fallback de login explícito si falta.
//
// [Auto-seed]: el test crea su PROPIO quiz vía API backend (login docente → POST /quiz)
// y lo borra al final. Antes dependía de un QUIZ_ID hardcodeado sembrado a mano — cada
// vez que ese quiz se borraba de la BD, el test fallaba con "Quiz no encontrado".
//
// [Nota de arquitectura]: la página /quiz es RSC — `listQuizzes()` corre server-side
// en Node, por lo que `page.route("**/api/v1/quiz?limit=*")` NUNCA intercepta ese
// fetch (Playwright solo intercepta requests del navegador). La independencia del
// estado de la BD se logra creando un quiz propio con id conocido.

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000/api/v1";
const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL ?? "docente@neuroedu.ia";
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASSWORD ?? "StrongP@ss123";

const QUIZ_TITLE_TEXT = "E2E Quiz Flow (auto-seed)";
const QUIZ_TITLE = new RegExp(QUIZ_TITLE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

// [Tolerancia de texto]: variaciones de la acción de ingreso a un examen.
// [Nota]: sin "ver" suelto — colisiona con "Volver a exámenes" (strict mode).
const ENTER_QUIZ_ACTION = /iniciar examen|ver detalles?\b|ingresar|comenzar/i;

// [Tope de seguridad]: evita loop infinito si la UI cambia (un quiz nunca supera esto)
const MAX_QUESTION_COUNT = 30;

let quizId: string;
let teacherToken: string;

// [Seed vía API]: quiz publicado con los 3 tipos de pregunta (multiple_choice,
// true_false, open_answer) para cubrir las tres ramas de la UI de juego.
test.beforeAll(async () => {
  // [Sin baseURL]: Playwright resuelve "/auth/login" contra la RAÍZ del host
  // (descarta el path /api/v1 del baseURL) — usamos URLs completas
  const api = await playwrightRequest.newContext();

  const loginRes = await api.post(`${BACKEND_URL}/auth/login`, {
    data: { email: TEACHER_EMAIL, password: TEACHER_PASSWORD },
  });
  expect(loginRes.ok(), "login docente debe responder 2xx").toBeTruthy();
  const loginBody = (await loginRes.json()) as {
    data: { accessToken: string };
  };
  teacherToken = loginBody.data.accessToken;

  const createRes = await api.post(`${BACKEND_URL}/quiz`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      title: QUIZ_TITLE_TEXT,
      description: "Quiz creado automáticamente por quiz-flow.spec.ts",
      category: "general",
      difficulty: "easy",
      isPublished: true,
      timePerQuestionSeconds: 60,
      questions: [
        {
          text: "¿Cuánto es 2 + 2?",
          type: "multiple_choice",
          options: ["4", "3", "5", "22"],
          correctAnswer: "4",
          difficulty: "easy",
        },
        {
          text: "El agua hierve a 100 °C a nivel del mar.",
          type: "true_false",
          options: ["true", "false"],
          correctAnswer: "true",
          difficulty: "easy",
        },
        {
          text: "Explica brevemente qué es la fotosíntesis.",
          type: "open_answer",
          correctAnswer:
            "Proceso por el cual las plantas convierten luz solar, agua y CO2 en energía química y oxígeno.",
          difficulty: "easy",
        },
      ],
    },
  });
  expect(createRes.ok(), "creación del quiz seed debe responder 2xx").toBeTruthy();
  const createBody = (await createRes.json()) as { data: { id: string } };
  quizId = createBody.data.id;
  await api.dispose();
});

// [Cleanup]: borra el quiz seed para no acumular basura en la BD entre corridas
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

test.describe("Quiz Flow · Estudiante", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/quiz");

    // [Fallback]: si storageState no aportó sesión, el proxy redirige a /login
    if (page.url().includes("/login")) {
      await page.getByLabel(/correo electrónico/i).fill("estudiante@neuroedu.ia");
      await page.getByLabel(/contraseña/i).fill("StrongP@ss123");
      await page.getByRole("button", { name: /iniciar sesión|ingresar/i }).click();
      await expect(page).toHaveURL(/\/quiz/);
    }
  });

  test("debe completar un examen de principio a fin", async ({ page }) => {
    // [Timeout extendido]: preguntas + calificación IA de respuestas abiertas
    test.setTimeout(180_000);
    // 1. Ir directo al detalle del quiz seed.
    //    [Por qué no la tarjeta]: si el usuario ya completó el quiz, QuizCard cambia
    //    su acción a "Ver feedback IA →" (href=/feedback) — la tarjeta deja de tener
    //    link al detalle y el test se volvería dependiente del historial de sesiones.
    await page.goto(`/quiz/${quizId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(QUIZ_TITLE);

    // 2. Página de detalle → iniciar el examen.
    //    [Race conocida]: la pregunta se renderiza ANTES de que el POST …/session
    //    termine; responder en ese hueco pierde el click (no hay sesión en el store).
    //    Esperar la respuesta del POST elimina la condición de carrera.
    await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}$`));
    const sessionStarted = page.waitForResponse(
      (res) => res.url().includes(`/api/quiz/${quizId}/session`) && res.ok(),
      { timeout: 30_000 },
    );
    await page.getByRole("link", { name: ENTER_QUIZ_ACTION }).click();
    await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}/play`));
    await sessionStarted;

    // 3. Responder cada pregunta hasta terminar.
    //    [UI real]: no existe botón "Comenzar" — la sesión arranca sola al montar.
    //    Tipos: multiple_choice / true_false (botones con aria-pressed) y
    //    open_answer (input con placeholder "Escribe la respuesta...").
    const questionHeading = page.getByRole("heading", { level: 2 });
    const openAnswerInput = page.getByPlaceholder(/escribe la respuesta/i);
    const submitButton = page.getByRole("button", { name: /^responder$/i });
    const nextButton = page.getByRole("button", { name: /siguiente|ver resultados/i });

    await expect(questionHeading).toBeVisible({ timeout: 15_000 });

    for (let questionIndex = 0; questionIndex < MAX_QUESTION_COUNT; questionIndex++) {
      // [Selección de respuesta]: input abierto o primera opción disponible
      if (await openAnswerInput.isVisible().catch(() => false)) {
        await openAnswerInput.fill("Respuesta de prueba para ser calificada por la IA.");
      } else {
        await page.locator("button[aria-pressed]").first().click();
      }

      await submitButton.click();

      // [Espera larga]: open_answer se califica vía ai-service (puede tardar segundos)
      await expect(nextButton).toBeVisible({ timeout: 30_000 });

      const isLastQuestion = /ver resultados/i.test(await nextButton.innerText());
      await nextButton.click();
      if (isLastQuestion) break;
    }

    // 4. Verificar la vista de resultado (semántico: heading + texto de aciertos)
    await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}/results`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: /resultados/i })).toBeVisible();

    const scoreSummary = await page.getByText(/aciertos:/i).innerText();
    console.log(`Resultado: ${scoreSummary}`);
  });
});
