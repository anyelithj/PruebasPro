import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
// [OllamaClient]: ÚNICO cliente HTTP de Ollama en NestJS; lo reutilizan los proveedores de preguntas (Aya, Qwen, Mistral), Curriculum, Cursos, Gramática, Poliglota, Música, Diálogos y Práctica | [Patrón]: Gateway + Adapter (Hexagonal) + Memoization | [Principio]: DRY + SRP + DIP | [Paradigma]: POO + async/await
// [Tecnología]: @nestjs/axios (HttpService/Axios) + RxJS (firstValueFrom) + API REST de Ollama (/api/generate, /api/show, /api/ps, /api/tags)
// [2026-10-24 · Equipos con poca RAM]: (1) `num_ctx` dimensionado al prompt real (2048–OLLAMA_NUM_CTX) en vez del contexto por defecto del modelo,
// (2) ante «out of memory» se descargan los demás modelos residentes y se reintenta, (3) si sigue sin caber se prueba la cadena OLLAMA_FALLBACK_MODELS
// (solo los instalados) y (4) el error final sugiere un modelo REALMENTE más pequeño con su `ollama pull` | [Patrón]: Retry + Fallback Chain + Error Translation | [Principio]: Fail Safe + OCP (la cadena se configura, no se programa)

// `export interface` (TS): campos de /api/generate que se usan (duraciones en nanosegundos) | [Principio]: ISP
export interface OllamaGenerateResponse {
  model?: string; // Modelo que respondió de verdad (puede ser uno de respaldo si el pedido no cabía en RAM)
  response: string; // Texto generado (JSON restringido por `format: 'json'`)
  prompt_eval_count?: number; // Tokens de entrada procesados
  eval_count?: number; // Tokens generados
  eval_duration?: number; // Tiempo de generación (ns)
  total_duration?: number; // Tiempo total de la petición (ns)
  load_duration?: number; // Tiempo cargando el modelo en memoria (ns); ~0 si ya estaba residente
}

// `export interface` (TS): petición mínima; cada consumidor solo decide modelo, prompt y opciones de muestreo | [Principio]: ISP
export interface OllamaGenerateRequest {
  model: string; // Tag exacto de Ollama (p. ej. aya-expanse:8b, qwen2.5:3b)
  prompt: string;
  options: {
    temperature: number;
    top_p?: number;
    num_predict: number;
    // `?` (TS): opcional e INFORMATIVO — OllamaClient calcula la ventana real según el prompt (ver contextFor) para no reservar RAM de más
    num_ctx?: number;
  };
}

// /api/show → cuantización y tamaño del modelo
export interface OllamaShowResponse {
  details?: { quantization_level?: string; parameter_size?: string };
}

// /api/ps → modelos residentes en memoria con su RAM y VRAM
export interface OllamaPsResponse {
  models?: Array<{
    name: string;
    model?: string;
    digest?: string;
    size?: number;
    size_vram?: number;
  }>;
}

// /api/tags → modelos instalados en disco (nombre + tamaño en bytes)
export interface OllamaTagsResponse {
  models?: Array<{ name: string; model?: string; size?: number }>;
}

// [Tipo de fallo]: decide la política (reintentar con otro modelo o rendirse) | `type` unión de literales (TS)
type OllamaFailure = 'oom' | 'missing' | 'other';

const NS_PER_MS = 1_000_000; // Nanosegundos → milisegundos (constante nombrada, sin números mágicos)
// `export const` + arrow function (ES2015): conversión pura reutilizable; `null` si Ollama no informa el dato | [Paradigma]: Funcional
export const nsToMs = (ns?: number): number | null =>
  typeof ns === 'number' ? Math.round(ns / NS_PER_MS) : null;

// [Ventana de contexto]: mínimo razonable y redondeo a bloques de 512 tokens (Ollama reserva el KV-cache completo de num_ctx → menos ventana = menos RAM)
export const MIN_CTX = 2048;
const CTX_STEP = 512;
const CHARS_PER_TOKEN = 3; // Estimación conservadora para español/francés con tildes e IPA (BPE ≈ 3–4 caracteres por token)
// [Escalera por defecto]: modelos multilingües pequeños usados como respaldo si OLLAMA_FALLBACK_MODELS no está definida
const DEFAULT_FALLBACK_MODELS = 'qwen2.5:1.5b,qwen2.5:0.5b';
// [Detección de memoria insuficiente]: mensajes reales de llama.cpp/Ollama («failed to allocate CPU_REPACK buffer», «requires more system memory», «out-of-memory»)
const OOM_RE =
  /out[ -]of[ -]memory|failed to allocate|requires more system memory|insufficient memory|not enough memory|cannot allocate/i;

// [contextFor]: tokens estimados del prompt + salida pedida + margen, redondeado y acotado a [MIN_CTX, max] | [Paradigma]: Funcional (pura, exportada para pruebas)
export function contextFor(
  prompt: string,
  numPredict: number,
  max: number,
): number {
  const needed = Math.ceil(prompt.length / CHARS_PER_TOKEN) + numPredict + 64; // `Math.ceil`: nunca se queda corta por redondeo
  const rounded = Math.ceil(needed / CTX_STEP) * CTX_STEP;
  return Math.min(Math.max(rounded, MIN_CTX), Math.max(max, MIN_CTX));
}

// [paramsOf]: "qwen2.5:3b" → 3 · "qwen2.5:0.5b" → 0.5 · sin tamaño en el tag → null | permite comparar «más pequeño» sin llamar a Ollama
export const paramsOf = (model: string): number | null => {
  const m = /:(\d+(?:\.\d+)?)b\b/i.exec(model); // `RegExp.exec` (JS): captura el número antes de la "b" del tag
  return m ? Number(m[1]) : null;
};

// [withTag]: Ollama nombra "mistral-nemo" como "mistral-nemo:latest" en /api/tags → comparación uniforme
const withTag = (name: string): string =>
  name.includes(':') ? name : `${name}:latest`;

// `@Injectable()` (NestJS): singleton del contenedor DI; el módulo AI es @Global → disponible en todo el backend
@Injectable()
export class OllamaClient {
  private readonly logger = new Logger(OllamaClient.name); // Logger de NestJS con el nombre de la clase como contexto
  private readonly baseUrl: string; // URL de Ollama sin barra final
  private readonly keepAlive: string; // Tiempo que el modelo sigue en RAM tras la última petición (corto → libera RAM pronto)
  readonly maxContext: number; // `readonly` (TS): tope de contexto (OLLAMA_NUM_CTX); los consumidores lo usan para su presupuesto de salida
  readonly fallbackModels: readonly string[]; // Cadena de respaldo (OLLAMA_FALLBACK_MODELS) en orden de preferencia
  private readonly TIMEOUT_MS = 600_000; // Modelos 7-8B en CPU pueden tardar minutos en arranque en frío | [Patrón]: Generous Timeout
  private readonly CONTROL_TIMEOUT_MS = 10_000; // /api/ps, /api/tags, /api/show y descargas: respuestas inmediatas
  // `Map` (ES2015): memo de /api/show por modelo; la cuantización no cambia entre peticiones | [Patrón]: Memoization
  private readonly modelInfo = new Map<
    string,
    Promise<OllamaShowResponse | null>
  >();

  constructor(
    private readonly http: HttpService, // Cliente Axios inyectado por @nestjs/axios
    config: ConfigService, // `ConfigService` (@nestjs/config): variables de entorno tipadas
  ) {
    this.baseUrl = config
      .get<string>('OLLAMA_BASE_URL', 'http://localhost:11434')
      .replace(/\/$/, '');
    this.keepAlive = config.get<string>('OLLAMA_KEEP_ALIVE', '2m');
    // `Number(...) || 4096`: si la variable no es numérica se usa el valor seguro por defecto (4096 cabe en equipos de 8 GB)
    this.maxContext =
      Number(config.get<string>('OLLAMA_NUM_CTX', '4096')) || 4096;
    // `split/map/filter` (ES5): "a, b,,c" → ["a","b","c"]
    this.fallbackModels = config
      .get<string>('OLLAMA_FALLBACK_MODELS', DEFAULT_FALLBACK_MODELS)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }

  // [generate]: una inferencia JSON; ante falta de RAM libera otros modelos y prueba la cadena de respaldo | [Patrón]: Facade + Retry + Fallback Chain
  async generate(
    request: OllamaGenerateRequest,
  ): Promise<OllamaGenerateResponse> {
    const tried: string[] = []; // Modelos intentados (para el mensaje final)
    let lastError: unknown;
    let lastFailure: OllamaFailure = 'other';

    // 1) Modelo pedido · si no cabe en RAM: descargar los demás residentes y reintentar UNA vez
    try {
      return await this.generateOnce(request.model, request);
    } catch (err) {
      tried.push(request.model);
      lastError = err;
      lastFailure = this.classify(err);
      if (lastFailure === 'other')
        throw this.translateError(request.model, err, tried); // Ollama apagado, timeout… → nada que reintentar
    }
    if (lastFailure === 'oom' && (await this.unloadOthers(request.model)) > 0) {
      try {
        return await this.generateOnce(request.model, request);
      } catch (err) {
        lastError = err;
        lastFailure = this.classify(err);
        if (lastFailure === 'other')
          throw this.translateError(request.model, err, tried);
      }
    }

    // 2) Cadena de respaldo: solo modelos instalados y distintos del pedido (`ollama pull` no se lanza solo: descargar GB sin permiso no es aceptable)
    const installed = await this.installedModels();
    const chain = this.fallbackModels.filter(
      (m) => withTag(m) !== withTag(request.model) && installed.has(withTag(m)),
    );
    for (const model of chain) {
      await this.unloadOthers(model); // Libera también el modelo que no cupo (pudo quedar a medio cargar)
      try {
        const res = await this.generateOnce(model, request);
        this.logger.warn(
          `Ollama: "${request.model}" no disponible (${lastFailure === 'oom' ? 'RAM insuficiente' : 'no instalado'}) → respondió el respaldo "${model}"`,
        );
        return res;
      } catch (err) {
        tried.push(model);
        lastError = err;
        lastFailure = this.classify(err);
        if (lastFailure === 'other') break; // Fallo no relacionado con RAM/instalación → se informa tal cual
      }
    }
    throw this.translateError(request.model, lastError, tried, installed);
  }

  // [generateOnce]: una llamada a /api/generate con un modelo concreto (sin política de reintentos) | [Principio]: SRP
  private async generateOnce(
    model: string,
    request: OllamaGenerateRequest,
  ): Promise<OllamaGenerateResponse> {
    const numCtx = contextFor(
      request.prompt,
      request.options.num_predict,
      this.maxContext,
    );
    const res = await firstValueFrom(
      this.http.post<OllamaGenerateResponse>(
        `${this.baseUrl}/api/generate`,
        {
          model,
          prompt: request.prompt,
          stream: false,
          format: 'json', // [Constrained Decoding]: Ollama limita la salida a JSON válido (clave en modelos pequeños)
          keep_alive: this.keepAlive, // Corto → el modelo se libera pronto tras la última petición (ahorro de RAM)
          // `...` (ES2018): opciones del consumidor con la ventana medida (num_ctx) y la salida acotada a lo que cabe en ella
          options: {
            ...request.options,
            num_ctx: numCtx,
            num_predict: Math.min(request.options.num_predict, numCtx),
          },
          // [Qwen3]: `think:false` evita el bloque <think> (menos tokens y latencia); qwen2.5 no admite el campo
          ...(model.startsWith('qwen3') ? { think: false } : {}),
        },
        { timeout: this.TIMEOUT_MS },
      ),
    );
    this.logMetrics(model, numCtx, res.data); // [Medición real]: tokens y tiempos informados por Ollama, no estimaciones
    return { ...res.data, model }; // `model`: el que respondió de verdad (trazabilidad del respaldo)
  }

  // [unloadOthers]: /api/ps → `keep_alive: 0` a cada modelo residente distinto de `keep` (Ollama lo descarga de RAM al instante) | devuelve cuántos se liberaron
  private async unloadOthers(keep: string): Promise<number> {
    const loaded = (await this.memory())?.models ?? [];
    const others = loaded
      .map((m) => m.name ?? m.model ?? '')
      .filter((name) => name && withTag(name) !== withTag(keep));
    // `Promise.allSettled` (ES2020): una descarga fallida no impide las demás
    await Promise.allSettled(
      others.map((name) =>
        firstValueFrom(
          this.http.post(
            `${this.baseUrl}/api/generate`,
            { model: name, keep_alive: 0 },
            { timeout: this.CONTROL_TIMEOUT_MS },
          ),
        ),
      ),
    );
    if (others.length)
      this.logger.warn(
        `Ollama: RAM insuficiente → descargados ${others.join(', ')} antes de cargar "${keep}"`,
      );
    return others.length;
  }

  // [installedModels]: nombres instalados (/api/tags) normalizados con tag; vacío si Ollama no responde
  private async installedModels(): Promise<Map<string, number>> {
    try {
      const res = await firstValueFrom(
        this.http.get<OllamaTagsResponse>(`${this.baseUrl}/api/tags`, {
          timeout: this.CONTROL_TIMEOUT_MS,
        }),
      );
      // `new Map(entries)` (ES2015): nombre → tamaño en bytes (0 si no se informa)
      return new Map(
        (res.data.models ?? []).map((m) => [withTag(m.name), m.size ?? 0]),
      );
    } catch {
      return new Map();
    }
  }

  // [showModel]: memoizado por modelo; un fallo no rompe la generación (devuelve null y se reintenta la próxima vez)
  showModel(model: string): Promise<OllamaShowResponse | null> {
    const cached = this.modelInfo.get(model);
    if (cached) return cached;
    const pending = firstValueFrom(
      this.http.post<OllamaShowResponse>(
        `${this.baseUrl}/api/show`,
        { model },
        { timeout: this.CONTROL_TIMEOUT_MS },
      ),
    )
      .then((r) => r.data)
      .catch(() => {
        this.modelInfo.delete(model); // Se olvida el fallo para reintentar en la próxima llamada
        return null;
      });
    this.modelInfo.set(model, pending);
    return pending;
  }

  // [memory]: modelos residentes y su RAM/VRAM (no se memoiza: cambia con el tiempo)
  async memory(): Promise<OllamaPsResponse | null> {
    try {
      const r = await firstValueFrom(
        this.http.get<OllamaPsResponse>(`${this.baseUrl}/api/ps`, {
          timeout: this.CONTROL_TIMEOUT_MS,
        }),
      );
      return r.data;
    } catch {
      return null;
    }
  }

  // [Métricas]: una línea de log estructurada por inferencia → comparar modelos con datos medidos
  private logMetrics(
    model: string,
    numCtx: number,
    r: OllamaGenerateResponse,
  ): void {
    // Tokens por segundo solo si Ollama informa conteo y duración; `toFixed(1)` (JS) redondea a un decimal
    const tps =
      r.eval_count && r.eval_duration
        ? (r.eval_count / (r.eval_duration / 1e9)).toFixed(1)
        : '0';
    this.logger.log(
      `llm_metrics model=${model} num_ctx=${numCtx} prompt_tokens=${r.prompt_eval_count ?? 0} output_tokens=${r.eval_count ?? 0} load_ms=${nsToMs(r.load_duration) ?? 0} total_ms=${nsToMs(r.total_duration) ?? 0} tokens_per_s=${tps}`,
    );
  }

  // [detailOf]: Ollama explica el fallo en el cuerpo `{ error }`; sin respuesta HTTP se usa el mensaje de Axios | `?.` (ES2020)
  private detailOf(err: unknown): string {
    return (
      (err as { response?: { data?: { error?: string } } }).response?.data
        ?.error ??
      (err as Error)?.message ??
      String(err)
    );
  }

  // [classify]: 404 = modelo no instalado · allocate/memory = RAM insuficiente · resto = otro (Ollama apagado, timeout…) | [Paradigma]: Funcional
  private classify(err: unknown): OllamaFailure {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) return 'missing';
    return OOM_RE.test(this.detailOf(err)) ? 'oom' : 'other';
  }

  // [suggestSmaller]: primer modelo de la cadena (o de la escalera por defecto) con MENOS parámetros que el que falló | null si ya es el más pequeño conocido
  private suggestSmaller(model: string): string | null {
    const size = paramsOf(model);
    const candidates = [
      ...new Set([
        ...this.fallbackModels,
        ...DEFAULT_FALLBACK_MODELS.split(','),
      ]),
    ];
    return (
      candidates.find((m) => {
        const p = paramsOf(m);
        return (
          withTag(m) !== withTag(model) &&
          (size === null || (p !== null && p < size))
        );
      }) ?? null
    );
  }

  // [translateError]: mensaje accionable para el docente/administrador | [Patrón]: Error Translation | [Principio]: SRP
  private translateError(
    model: string,
    err: unknown,
    tried: string[] = [model],
    installed: Map<string, number> = new Map(),
  ): ServiceUnavailableException {
    const failure = this.classify(err);
    const detail = this.detailOf(err);
    const triedText = tried.map((m) => `"${m}"`).join(', ');
    let hint: string;
    if (failure === 'missing') {
      hint = `El modelo no está instalado. Ejecuta: ollama pull ${model}`;
    } else if (failure === 'oom') {
      const smaller = this.suggestSmaller(model);
      // Ya instalado pero fuera de la cadena → basta con configurarlo; si no, hay que descargarlo
      hint = !smaller
        ? `Memoria RAM insuficiente incluso para ${triedText}: cierra aplicaciones (navegador, Docker) y vuelve a intentarlo.`
        : installed.has(withTag(smaller))
          ? `Memoria RAM insuficiente (probados: ${triedText}). Añade "${smaller}" (ya instalado) a OLLAMA_FALLBACK_MODELS o úsalo como modelo del motor, y cierra aplicaciones.`
          : `Memoria RAM insuficiente (probados: ${triedText}). Instala un modelo más pequeño: ollama pull ${smaller} (se usa solo como respaldo vía OLLAMA_FALLBACK_MODELS) y cierra aplicaciones.`;
    } else {
      hint = `Verifica que Ollama esté activo en ${this.baseUrl}.`;
    }
    this.logger.error(
      `Ollama falló (modelo "${model}" en ${this.baseUrl}; probados: ${triedText}): ${detail}`,
    );
    return new ServiceUnavailableException(
      `IA no disponible (${model}): ${hint}`,
    );
  }
}
