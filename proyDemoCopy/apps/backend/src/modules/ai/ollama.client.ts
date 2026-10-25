import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
// [OllamaClient]: ÚNICO cliente HTTP de Ollama en NestJS; lo reutilizan los proveedores de preguntas (Aya, Qwen, Mistral) y el adaptador de Curriculum | [Patrón]: Gateway + Adapter (Hexagonal) + Memoization | [Principio]: DRY + SRP + DIP | [Paradigma]: POO + async/await
// [Tecnología]: @nestjs/axios (HttpService/Axios) + RxJS (firstValueFrom) + API REST de Ollama (/api/generate, /api/show, /api/ps)

// `export interface` (TS): campos de /api/generate que se usan (duraciones en nanosegundos) | [Principio]: ISP
export interface OllamaGenerateResponse {
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
    num_ctx: number;
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

const NS_PER_MS = 1_000_000; // Nanosegundos → milisegundos (constante nombrada, sin números mágicos)
// `export const` + arrow function (ES2015): conversión pura reutilizable; `null` si Ollama no informa el dato | [Paradigma]: Funcional
export const nsToMs = (ns?: number): number | null =>
  typeof ns === 'number' ? Math.round(ns / NS_PER_MS) : null;

// `@Injectable()` (NestJS): singleton del contenedor DI; el módulo AI es @Global → disponible en todo el backend
@Injectable()
export class OllamaClient {
  private readonly logger = new Logger(OllamaClient.name); // Logger de NestJS con el nombre de la clase como contexto
  private readonly baseUrl: string; // URL de Ollama sin barra final
  private readonly keepAlive: string; // Tiempo que el modelo sigue en RAM tras la última petición (carga bajo demanda)
  readonly maxContext: number; // `readonly` (TS): tope de contexto que los consumidores usan para dimensionar num_ctx
  private readonly TIMEOUT_MS = 600_000; // Modelos 7-8B en CPU pueden tardar minutos en arranque en frío | [Patrón]: Generous Timeout
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
    this.keepAlive = config.get<string>('OLLAMA_KEEP_ALIVE', '5m');
    // `Number(...) || 8192`: si la variable no es numérica se usa el valor seguro por defecto
    this.maxContext =
      Number(config.get<string>('OLLAMA_NUM_CTX', '8192')) || 8192;
  }

  // [generate]: una inferencia JSON con métricas en el log y errores traducidos a pistas accionables | [Patrón]: Facade + Error Translation
  async generate(
    request: OllamaGenerateRequest,
  ): Promise<OllamaGenerateResponse> {
    try {
      const res = await firstValueFrom(
        this.http.post<OllamaGenerateResponse>(
          `${this.baseUrl}/api/generate`,
          {
            ...request, // `...` (ES2018): copia modelo, prompt y opciones del consumidor
            stream: false,
            format: 'json', // [Constrained Decoding]: Ollama limita la salida a JSON válido (clave en modelos pequeños)
            keep_alive: this.keepAlive, // Un solo modelo residente y liberado tras inactividad (ahorro de RAM)
            // [Qwen3]: `think:false` evita el bloque <think> (menos tokens y latencia); qwen2.5 no admite el campo
            ...(request.model.startsWith('qwen3') ? { think: false } : {}),
          },
          { timeout: this.TIMEOUT_MS },
        ),
      );
      this.logMetrics(request.model, res.data); // [Medición real]: tokens y tiempos informados por Ollama, no estimaciones
      return res.data;
    } catch (err) {
      throw this.translateError(request.model, err); // `throw` de la excepción ya traducida (una sola política de errores)
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
        { timeout: 10_000 },
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
  memory(): Promise<OllamaPsResponse | null> {
    return firstValueFrom(
      this.http.get<OllamaPsResponse>(`${this.baseUrl}/api/ps`, {
        timeout: 10_000,
      }),
    )
      .then((r) => r.data)
      .catch(() => null);
  }

  // [Métricas]: una línea de log estructurada por inferencia → comparar modelos con datos medidos
  private logMetrics(model: string, r: OllamaGenerateResponse): void {
    // Tokens por segundo solo si Ollama informa conteo y duración; `toFixed(1)` (JS) redondea a un decimal
    const tps =
      r.eval_count && r.eval_duration
        ? (r.eval_count / (r.eval_duration / 1e9)).toFixed(1)
        : '0';
    this.logger.log(
      `llm_metrics model=${model} prompt_tokens=${r.prompt_eval_count ?? 0} output_tokens=${r.eval_count ?? 0} load_ms=${nsToMs(r.load_duration) ?? 0} total_ms=${nsToMs(r.total_duration) ?? 0} tokens_per_s=${tps}`,
    );
  }

  // [translateError]: 404 = modelo no instalado · allocate/memory = RAM insuficiente · resto = Ollama apagado | [Patrón]: Error Translation | [Principio]: SRP
  private translateError(
    model: string,
    err: unknown,
  ): ServiceUnavailableException {
    // `?.` (ES2020): tolera errores sin respuesta HTTP; Ollama explica el fallo en el cuerpo `{ error }`
    const status = (err as { response?: { status?: number } }).response?.status;
    const detail =
      (err as { response?: { data?: { error?: string } } }).response?.data
        ?.error ?? (err as Error).message;
    const hint =
      status === 404
        ? `El modelo no está instalado. Ejecuta: ollama pull ${model}`
        : /allocate|memory/i.test(detail)
          ? 'Memoria RAM insuficiente para cargar el modelo: cierra aplicaciones o configura un modelo más pequeño (p. ej. qwen2.5:3b).'
          : `Verifica que Ollama esté activo en ${this.baseUrl}.`;
    this.logger.error(
      `Ollama falló (modelo "${model}" en ${this.baseUrl}): ${detail}`,
    );
    return new ServiceUnavailableException(
      `IA no disponible (${model}): ${hint}`,
    );
  }
}
