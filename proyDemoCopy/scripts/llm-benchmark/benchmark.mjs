// [Benchmark de LLM locales]: compara modelos de Ollama con las MISMAS tareas y registra solo métricas medibles | [Patrón]: Test Harness + Strategy (tareas intercambiables) | [Principio]: SRP + medición antes de optimizar | [Paradigma]: Funcional + async/await
// [Tecnología]: Node.js 22 (ES Modules .mjs, fetch nativo, módulo `os`) — sin dependencias externas
// Uso: node scripts/llm-benchmark/benchmark.mjs aya-expanse:8b qwen3:8b
// [Honestidad]: tokens y tiempos vienen de la respuesta de Ollama; RAM de /api/ps y del SO. CPU %, energía y agua NO se miden (no hay medidor fiable).

import os from "node:os"; // `import` (ESM): módulo del sistema operativo (memoria libre/total)
import http from "node:http"; // Cliente HTTP nativo sin el límite de 300 s de undici
import { mkdirSync, writeFileSync } from "node:fs"; // Escritura de resultados
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"; // `??` (ES2020): valor por defecto
const MODELS = process.argv.slice(2); // Modelos pasados por línea de comandos
const HERE = dirname(fileURLToPath(import.meta.url)); // `import.meta.url` (ESM): ruta de este archivo
const OUT_DIR = join(HERE, "..", "..", "documentos proyecto", "benchmarks"); // Carpeta de salida

// [Tareas]: mismas para todos los modelos; cortas para limitar tokens y tiempo en CPU | [Patrón]: Strategy
// `validate` es una comprobación DETERMINISTA de estructura; la calidad lingüística se revisa a mano con las salidas guardadas.
const TASKS = [
  {
    id: "gen-fr-b1",
    description: "Generar 2 ejercicios de opción múltiple en francés (B1, gramática) en JSON",
    prompt:
      'Genera exactamente 2 preguntas ORIGINALES de opción múltiple para practicar gramática de FRANCÉS nivel MCER B1 (passé composé vs imparfait). "text", "options" y "correctAnswer" en francés; "explanation" en español. Devuelve SOLO JSON: {"questions":[{"text":"","options":["","","",""],"correctAnswer":"","explanation":""}]}',
    validate: (j) => checkQuestions(j, 2),
  },
  {
    id: "gen-de-a2",
    description: "Generar 2 ejercicios en alemán (A2, vocabulario) en JSON",
    prompt:
      'Genera exactamente 2 preguntas ORIGINALES de opción múltiple de vocabulario de ALEMÁN nivel A2 (comida y compras). Contenido en alemán, "explanation" en español. SOLO JSON: {"questions":[{"text":"","options":["","","",""],"correctAnswer":"","explanation":""}]}',
    validate: (j) => checkQuestions(j, 2),
  },
  {
    id: "gen-zh-a1",
    description: "Generar 2 ejercicios en chino mandarín (A1) con pinyin en JSON",
    prompt:
      'Genera exactamente 2 preguntas ORIGINALES de opción múltiple de CHINO MANDARÍN nivel A1 (saludos). Usa caracteres simplificados en "text" y "options"; incluye "pinyin" con tonos de la respuesta correcta; "explanation" en español. SOLO JSON: {"questions":[{"text":"","options":["","","",""],"correctAnswer":"","pinyin":"","explanation":""}]}',
    validate: (j) => checkQuestions(j, 2) && /[一-鿿]/.test(JSON.stringify(j)), // Debe contener caracteres CJK
  },
  {
    id: "gen-ru-b2",
    description: "Generar 2 ejercicios en ruso (B2, casos gramaticales) en JSON",
    prompt:
      'Genera exactamente 2 preguntas ORIGINALES de opción múltiple de RUSO nivel B2 (uso de casos). Contenido en ruso (cirílico), "explanation" en español. SOLO JSON: {"questions":[{"text":"","options":["","","",""],"correctAnswer":"","explanation":""}]}',
    validate: (j) => checkQuestions(j, 2) && /[Ѐ-ӿ]/.test(JSON.stringify(j)), // Debe contener cirílico
  },
  {
    id: "correct-en-b1",
    description: "Corregir una frase en inglés y explicar el error (feedback) en JSON",
    prompt:
      'Un estudiante de INGLÉS B1 escribió: "She don\'t like coffee and she go to work by bus yesterday." Identifica cada error objetivo, da la corrección y explícalo en español sin inventar errores. SOLO JSON: {"errors":[{"original":"","correction":"","explanationEs":""}],"correctedSentence":""}',
    validate: (j) => Array.isArray(j?.errors) && j.errors.length >= 2 && typeof j.correctedSentence === "string",
  },
];

// [Validador estructural reutilizable]: N preguntas, 4 opciones, respuesta ∈ opciones | función pura
function checkQuestions(j, n) {
  const qs = Array.isArray(j) ? j : j?.questions; // Acepta array directo o envuelto
  return (
    Array.isArray(qs) &&
    qs.length === n &&
    qs.every((q) => Array.isArray(q.options) && q.options.length >= 3 && q.options.includes(q.correctAnswer) && q.explanation)
  );
}

// `async function`: POST /api/generate con salida JSON restringida (constrained decoding) y parámetros acotados
async function generate(model, prompt) {
  const body = {
    model,
    prompt,
    stream: false,
    format: "json", // Gramática JSON de Ollama → menos reintentos por formato
    keep_alive: "5m", // Mantener cargado entre tareas del MISMO modelo
    options: { temperature: 0.3, num_predict: 900, num_ctx: 4096 }, // Límites explícitos de salida y contexto
  };
  if (model.startsWith("qwen3")) body.think = false; // Qwen3: sin bloque de razonamiento (menos tokens)
  return postJson(`${OLLAMA}/api/generate`, body); // Incluye response + métricas (duraciones en ns y conteos de tokens)
}

// [POST JSON con node:http]: el `fetch` global (undici) aborta a los 300 s esperando cabeceras ("fetch failed");
// la inferencia en CPU con poca RAM puede tardar más → `http.request` con timeout explícito de 30 min | [Patrón]: Adapter
function postJson(url, payload) {
  // `new Promise` (ES2015): envuelve la API de callbacks de node:http en una promesa (async/await)
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let data = ""; // Acumula los chunks de la respuesta
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c)); // Evento 'data' (Streams de Node)
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.setTimeout(30 * 60 * 1000, () => req.destroy(new Error("timeout 30 min"))); // Límite explícito y generoso
    req.on("error", reject);
    req.end(JSON.stringify(payload)); // Envía el cuerpo y cierra la petición
  });
}

// [RAM del modelo]: /api/ps informa bytes en memoria (size) y en VRAM (size_vram) del modelo cargado
async function modelMemory(model) {
  const ps = await (await fetch(`${OLLAMA}/api/ps`)).json();
  const m = (ps.models ?? []).find((x) => x.name === model || x.model === model);
  return m ? { sizeMB: Math.round(m.size / 2 ** 20), vramMB: Math.round((m.size_vram ?? 0) / 2 ** 20) } : null;
}

// [Descarga del modelo]: keep_alive 0 → Ollama lo libera de RAM ya → nunca dos modelos a la vez
async function unload(model) {
  await postJson(`${OLLAMA}/api/generate`, { model, keep_alive: 0 });
}

const ms = (ns) => Math.round((ns ?? 0) / 1e6); // Nanosegundos → milisegundos
const mb = (b) => Math.round(b / 2 ** 20); // Bytes → MiB

// [Programa principal]: `async` IIFE implícito con top-level await (ESM)
if (MODELS.length === 0) {
  console.error("Indica al menos un modelo: node benchmark.mjs aya-expanse:8b qwen3:8b");
  process.exit(1); // Código de salida ≠ 0 = error
}

const machine = {
  cpu: os.cpus()[0]?.model, // Modelo de CPU
  threads: os.cpus().length, // Hilos lógicos
  totalRamMB: mb(os.totalmem()),
  platform: `${os.platform()} ${os.release()}`,
};
const results = []; // Acumulador de filas

for (const model of MODELS) {
  const freeBeforeMB = mb(os.freemem()); // RAM libre del SO antes de cargar el modelo
  for (const task of TASKS) {
    const started = Date.now(); // Reloj de pared (incluye red local)
    let row;
    try {
      const r = await generate(model, task.prompt);
      let parsed = null;
      try {
        parsed = JSON.parse(r.response); // Validez JSON
      } catch {
        /* JSON inválido: se registra como fallo estructural */
      }
      row = {
        model,
        task: task.id,
        jsonValid: parsed !== null,
        structureValid: parsed !== null && Boolean(task.validate(parsed)),
        promptTokens: r.prompt_eval_count ?? 0,
        outputTokens: r.eval_count ?? 0,
        loadMs: ms(r.load_duration), // > 0 solo en la primera tarea (carga en frío)
        totalMs: ms(r.total_duration),
        wallMs: Date.now() - started,
        tokensPerSec: r.eval_duration ? +(r.eval_count / (r.eval_duration / 1e9)).toFixed(2) : 0,
        output: r.response, // Guardado para revisión humana de la calidad lingüística
      };
    } catch (err) {
      row = { model, task: task.id, error: String(err?.message ?? err) };
    }
    const mem = await modelMemory(model); // Memoria del modelo mientras está cargado
    row.modelMemMB = mem?.sizeMB ?? null;
    row.vramMB = mem?.vramMB ?? null;
    row.systemFreeRamMB = mb(os.freemem());
    results.push(row);
    if (row.error) console.log(`${model} ${task.id}: ERROR ${row.error}`);
    else console.log(`${model} ${task.id}: json=${row.jsonValid} struct=${row.structureValid} out=${row.outputTokens} tok total=${row.totalMs}ms mem=${row.modelMemMB}MB`);
  }
  results.push({ model, task: "_ram_before_load", systemFreeRamMB: freeBeforeMB });
  await unload(model); // Liberar antes del siguiente modelo
}

// [Persistencia]: JSON completo (con salidas) + resumen Markdown
mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
writeFileSync(join(OUT_DIR, `llm-benchmark-${stamp}.json`), JSON.stringify({ machine, results }, null, 2));

const rows = results.filter((r) => !r.task.startsWith("_"));
const summary = MODELS.map((model) => {
  const mine = rows.filter((r) => r.model === model && !r.error);
  const avg = (k) => (mine.length ? Math.round(mine.reduce((s, r) => s + (r[k] ?? 0), 0) / mine.length) : 0);
  return {
    model,
    tasks: `${mine.length}/${TASKS.length}`,
    structureOk: mine.filter((r) => r.structureValid).length,
    avgOutputTokens: avg("outputTokens"),
    avgTotalMs: avg("totalMs"),
    avgTokensPerSec: mine.length ? +(mine.reduce((s, r) => s + r.tokensPerSec, 0) / mine.length).toFixed(2) : 0,
    coldLoadMs: mine[0]?.loadMs ?? 0,
    modelMemMB: Math.max(0, ...mine.map((r) => r.modelMemMB ?? 0)),
  };
});
const md = [
  `# Benchmark LLM local — ${stamp}`,
  "",
  `Equipo: ${machine.cpu} · ${machine.threads} hilos · ${machine.totalRamMB} MiB RAM · ${machine.platform}`,
  "",
  "| Modelo | Tareas OK | Estructura válida | Tokens salida (media) | Tiempo total medio (ms) | Tokens/s | Carga en frío (ms) | Memoria modelo (MiB) |",
  "|---|---|---|---|---|---|---|---|",
  ...summary.map((s) => `| ${s.model} | ${s.tasks} | ${s.structureOk}/${TASKS.length} | ${s.avgOutputTokens} | ${s.avgTotalMs} | ${s.avgTokensPerSec} | ${s.coldLoadMs} | ${s.modelMemMB} |`),
  "",
  "Métricas de Ollama (tokens, duraciones) y de /api/ps (memoria). CPU %, energía y agua no se midieron.",
  "La validez estructural es automática; la calidad lingüística requiere revisión humana de `output` en el JSON.",
].join("\n");
writeFileSync(join(OUT_DIR, `llm-benchmark-${stamp}.md`), md);
console.log("\n" + md);
