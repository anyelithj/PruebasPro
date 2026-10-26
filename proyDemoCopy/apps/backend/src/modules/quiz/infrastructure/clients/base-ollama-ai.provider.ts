import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import type {
  AIGeneratedQuestion,
  GenerateAIQuestionsOptions,
  IAIQuestionProvider,
} from '../../domain/interfaces/ai-question-provider.interface';
import {
  AIProvider,
  AI_PROVIDER_LABEL,
} from '../../domain/value-objects/ai-provider.vo';
import {
  Category,
  CATEGORY_LABEL_ES,
} from '../../domain/value-objects/category.vo';
import {
  Difficulty,
  DIFFICULTY_CEFR_BAND,
} from '../../domain/value-objects/difficulty.vo';
import {
  DEFAULT_LANGUAGE,
  INSTRUCTION_LANGUAGE,
  Language,
  LANGUAGE_LABEL,
} from '../../domain/value-objects/language.vo';
import { QuestionType } from '../../domain/entities/question.entity';
// [Adapter base Ollama AI]: clase abstracta para los proveedores de preguntas (Aya, Qwen, Mistral); el HTTP, las métricas y los errores los resuelve OllamaClient (módulo AI) | [Patrón]: Template Method + Adapter (Hexagonal) | [Principio]: DRY + DIP + OCP + SRP | [Paradigma]: POO

// [Forma cruda esperada del LLM]: validada antes de mapear a AIGeneratedQuestion | [Principio]: Robustez
interface RawAIQuestion {
  text: string;
  type: 'multiple_choice' | 'true_false' | 'open_answer';
  // [options opcional]: open_answer no lleva opciones | [Principio]: ISP
  options?: string[];
  correctAnswer: string;
  explanation: string;
  feedback: string;
}

// [Template Method]: subclases solo definen id + model | [Patrón]: Template Method | [Principio]: OCP
@Injectable()
export abstract class BaseOllamaAIProvider implements IAIQuestionProvider {
  protected readonly logger: Logger;

  // [Identidad del provider]: definida por subclase | [Patrón]: Template Method
  abstract readonly id: AIProvider;
  // [Modelo Ollama]: tag exacto (ej qwen3:8b) | [Patrón]: Template Method
  protected abstract readonly model: string;
  // `get` (ES2015): expone el tag en solo lectura para la factory (diagnóstico de motores duplicados) sin abrir `model` a escritura
  get modelTag(): string {
    return this.model;
  }

  constructor(
    protected readonly ollama: OllamaClient, // [DI]: cliente compartido del módulo AI (@Global) → un solo cliente HTTP de Ollama | [Principio]: DIP + DRY
    protected readonly config: ConfigService, // Lee el tag del modelo de cada subclase (OLLAMA_*_MODEL)
  ) {
    this.logger = new Logger(this.constructor.name); // `this.constructor.name`: contexto del log = subclase concreta
  }

  // [API pública]: implementación común para todos los providers Ollama | [Patrón]: Template Method
  async generateQuestions(
    options: GenerateAIQuestionsOptions,
  ): Promise<AIGeneratedQuestion[]> {
    const prompt = this.buildPrompt(options);
    this.logger.log(
      `Generando ${options.amount} preguntas — provider=${AI_PROVIDER_LABEL[this.id]} model=${this.model} topic="${options.topic}"`,
    );
    const raw = await this.callOllama(prompt, options.amount);
    if (!raw || !raw.trim()) {
      throw new ServiceUnavailableException(
        `Ollama (${this.model}) devolvió respuesta vacía. Verifica: ollama pull ${this.model}`,
      );
    }

    const parsed = this.parseJsonArray(raw);
    return parsed
      .map((q) => this.healRawQuestion(q, options))
      .filter((q): q is RawAIQuestion => this.isValidRawQuestion(q))
      .map((q) => this.normalize(q, options));
  }

  // [Llamada a Ollama]: solo dimensiona el presupuesto de tokens; el transporte es de OllamaClient | [Patrón]: Delegation | [Principio]: SRP
  protected async callOllama(prompt: string, amount = 5): Promise<string> {
    const maxCtx = this.ollama.maxContext; // Tope de contexto común (OLLAMA_NUM_CTX), leído una sola vez en OllamaClient
    // [Presupuesto de tokens escalado por cantidad]: ~320 tok/pregunta + holgura; un num_predict fijo truncaba el JSON | [Patrón]: Adaptive Budget
    const numPredict = Math.min(maxCtx, 768 + amount * 320);
    // [num_ctx debe cubrir prompt + salida]: si la ventana es menor que la salida, el modelo trunca | [Patrón]: Context Sizing
    const numCtx = Math.min(maxCtx, 2048 + amount * 320);
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      // [Temperatura baja]: contenido educativo necesita consistencia, no creatividad excesiva | [Patrón]: Tuning
      options: {
        temperature: 0.4,
        top_p: 0.9,
        num_predict: numPredict,
        num_ctx: numCtx,
      },
    });
    return res.response ?? ''; // `??` (ES2020): cadena vacía si Ollama no devolvió texto
  }

  // [Prompt builder]: extraído como Template Method para que subclases ajusten si quieren | [Patrón]: Template Method | [Principio]: OCP
  protected buildPrompt(options: GenerateAIQuestionsOptions): string {
    const language = options.language ?? DEFAULT_LANGUAGE;
    const difficulty = options.difficulty ?? Difficulty.MEDIUM;
    const category = options.category ?? Category.GENERAL;
    const type = options.type ?? QuestionType.MULTIPLE_CHOICE;
    const isMultipleChoice = type === QuestionType.MULTIPLE_CHOICE;
    const isOpenAnswer = type === QuestionType.OPEN_ANSWER;
    const languageName = LANGUAGE_LABEL[language];
    const competence = CATEGORY_LABEL_ES[category] ?? category;
    const cefrBand = DIFFICULTY_CEFR_BAND[difficulty];
    // [Idioma objetivo vs. idioma de instrucción]: el contenido evaluado va en el idioma que se aprende; la explicación y el feedback, en español | [Principio]: SRP
    const langInstruction = [
      `"text", "options" y "correctAnswer" DEBEN estar escritos en ${languageName}, con vocabulario y estructuras propios del nivel MCER ${cefrBand}.`,
      `"explanation" y "feedback" DEBEN estar en ${LANGUAGE_LABEL[INSTRUCTION_LANGUAGE]} claro; cuando cites palabras del ${languageName}, añade su traducción al ${LANGUAGE_LABEL[INSTRUCTION_LANGUAGE]} entre paréntesis.`,
      language === Language.ZH
        ? 'Para chino mandarín usa caracteres simplificados.'
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    // [Schema JSON estricto]: define formato exacto esperado para parser robusto | [Patrón]: Schema-driven prompt
    // [Marcadores genéricos, NO contenido real]: un ejemplo concreto ("capital de Francia",
    // "fotosíntesis") era copiado literalmente por modelos pequeños y contaminaba quizzes
    // de cualquier tema. El ejemplo ahora solo ilustra ESTRUCTURA | [Patrón]: Anti-anchoring
    const schemaExample = isMultipleChoice
      ? `[
  {
    "text": "<pregunta concreta y verificable sobre el TEMA>",
    "type": "multiple_choice",
    "options": ["<respuesta correcta>", "<distractor 1>", "<distractor 2>", "<distractor 3>"],
    "correctAnswer": "<respuesta correcta, idéntica a una de las options>",
    "explanation": "<justificación académica de la respuesta correcta (2-3 oraciones)>",
    "feedback": "<orientación pedagógica para comprender el concepto (1-2 oraciones)>"
  }
]`
      : isOpenAnswer
        ? `[
  {
    "text": "<pregunta de desarrollo sobre el TEMA>",
    "type": "open_answer",
    "correctAnswer": "<respuesta modelo concreta y evaluable (1-3 oraciones)>",
    "explanation": "<por qué esa respuesta es la correcta>",
    "feedback": "<cómo estructurar una buena respuesta sobre este concepto>"
  }
]`
        : `[
  {
    "text": "<afirmación verificable sobre el TEMA>",
    "type": "true_false",
    "options": ["true", "false"],
    "correctAnswer": "true",
    "explanation": "<razón académica por la cual la afirmación es verdadera o falsa>",
    "feedback": "<orientación pedagógica sobre cómo abordar este concepto>"
  }
]`;

    return [
      `Eres un docente experto en enseñanza de idiomas según el MCER/CEFR. Tu tarea es generar exactamente ${options.amount} preguntas ORIGINALES de práctica (no copies ítems de exámenes oficiales).`,
      '',
      `IDIOMA OBJETIVO: ${languageName}`,
      `COMPETENCIA: ${competence}`,
      `NIVEL MCER: ${cefrBand}`,
      `TEMA: ${options.topic}`,
      `TIPO: ${type}`,
      '',
      'REGLAS ESTRICTAS:',
      `0. TODAS las preguntas deben evaluar la COMPETENCIA "${competence}" del ${languageName} sobre el TEMA: "${options.topic}". Está PROHIBIDO generar preguntas de otro tema o de otro idioma.`,
      `1. ${langInstruction}`,
      `2. Devuelve SOLO un array JSON válido. Sin texto antes ni después, sin markdown, sin "\\\`\\\`\\\`json".`,
      `3. Exactamente ${options.amount} elementos en el array.`,
      isOpenAnswer
        ? '4. open_answer: NO incluyas el campo "options". La "correctAnswer" es la respuesta modelo redactada (1-3 oraciones).'
        : '4. Cada pregunta debe ser coherente: la "correctAnswer" debe estar literalmente entre las "options".',
      isMultipleChoice
        ? '5. multiple_choice: exactamente 4 opciones, claramente distinguibles, una sola correcta. Distractores plausibles pero incorrectos.'
        : isOpenAnswer
          ? '5. open_answer: pregunta de desarrollo; sin opciones. La respuesta modelo debe ser concreta y evaluable.'
          : '5. true_false: options siempre ["true", "false"]. correctAnswer es "true" o "false".',
      isMultipleChoice
        ? '5b. Cada opción y la "correctAnswer" deben contener el CONTENIDO REAL de la respuesta (ej. "París"), NUNCA etiquetas genéricas como "Opción A", "Opción B", "A)", "Respuesta 1" ni letras sueltas. La "correctAnswer" debe ser idéntica (carácter por carácter) a una de las "options".'
        : isOpenAnswer
          ? '5b. La "correctAnswer" debe contener el CONTENIDO real de la respuesta, nunca etiquetas genéricas.'
          : '5b. La "correctAnswer" debe ser exactamente "true" o "false".',
      '6. "explanation" debe justificar la respuesta correcta citando la regla gramatical, el significado o el uso (2-3 oraciones).',
      '7. "feedback" debe indicar el error típico y cómo evitarlo (1-2 oraciones).',
      '8. No repitas preguntas. Varía aspectos del tema.',
      '9. El formato de abajo usa marcadores entre <>: SUSTITÚYELOS por contenido real del TEMA. No copies los marcadores ni inventes contenido de otros temas.',
      '',
      'FORMATO EXACTO DE SALIDA (array JSON):',
      schemaExample,
      '',
      'Genera ahora el array JSON:',
    ].join('\n');
  }

  // [Parser robusto JSON]: modelos pequeños (1-3B) suelen devolver objeto único, objetos sueltos, bloques <think> o prosa. Toleramos todos | [Patrón]: Lenient Parser | [Principio]: Robustez
  protected parseJsonArray(raw: string): unknown[] {
    const text = this.stripNoise(raw);

    // 0. [format:'json' garantiza JSON válido]: parsear el texto completo primero. Con
    // constrained decoding el modelo suele envolver en objeto ({"questions":[...]} o
    // {"pregunta1":{...},...}) en vez de array — desenvolvemos | [Patrón]: Unwrap
    try {
      const whole: unknown = JSON.parse(text.trim());
      const unwrapped = this.unwrapQuestions(whole);
      if (unwrapped.length > 0) return unwrapped;
    } catch {
      // [No era JSON completo]: seguimos con extracción tolerante
    }

    // 1. Intento principal: array JSON balanceado [ ... ]
    const arrStr = this.extractBalanced(text, '[', ']');
    if (arrStr) {
      try {
        const parsed: unknown = JSON.parse(arrStr); // `unknown` (TS): obliga a validar antes de usar
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        this.logger.warn(
          `JSON.parse de array falló: ${(err as Error).message}. Intentando objetos sueltos.`,
        );
      }
    }

    // 2. Fallback: recolectar objetos { ... } sueltos (modelo devolvió uno o varios sin envolver en array)
    const objects = this.extractObjects(text);
    if (objects.length > 0) {
      this.logger.warn(
        `Recuperados ${objects.length} objeto(s) JSON sin array contenedor.`,
      );
      return objects;
    }

    this.logger.warn(`No se pudo extraer JSON del output del modelo`);
    return [];
  }

  // [Self-healing de output de modelos pequeños]: repara defectos comunes (1-3B) en vez de
  // descartar preguntas por lo demás válidas | [Patrón]: Self-healing | [Principio]: Robustez
  private healRawQuestion(
    q: unknown,
    options: GenerateAIQuestionsOptions,
  ): unknown {
    if (!q || typeof q !== 'object') return q;
    const obj: Record<string, unknown> = { ...(q as Record<string, unknown>) };

    // 1. [<Contenido Real>]: el modelo copió el estilo de marcador del schema envolviendo
    // contenido real en <> (ej. "<Spear Phishing>"). Desenvolvemos salvo marcadores genuinos.
    const unwrapAngle = (v: unknown): unknown => {
      if (typeof v !== 'string') return v;
      const m = v.trim().match(/^<(.+)>$/s);
      if (!m) return v;
      const inner = m[1].trim();
      // [Marcadores genuinos del schema]: empiezan con palabras del prompt — esos sí se descartan después
      if (
        /^(pregunta|respuesta|distractor|afirmaci[oó]n|justificaci[oó]n|orientaci[oó]n|por qu[eé]|c[oó]mo)/i.test(
          inner,
        )
      ) {
        return v;
      }
      return inner;
    };
    obj.text = unwrapAngle(obj.text);
    obj.correctAnswer = unwrapAngle(obj.correctAnswer);
    if (Array.isArray(obj.options)) obj.options = obj.options.map(unwrapAngle);

    // 2. [type ausente o inválido]: el modelo lo omite o inventa — usamos el tipo solicitado
    const validTypes: string[] = [
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.TRUE_FALSE,
      QuestionType.OPEN_ANSWER,
    ];
    if (typeof obj.type !== 'string' || !validTypes.includes(obj.type)) {
      obj.type = options.type ?? QuestionType.MULTIPLE_CHOICE;
    }

    // 3. [explanation/feedback ausentes]: metadatos pedagógicos opcionales — vacío en vez de descartar
    if (typeof obj.explanation !== 'string') obj.explanation = '';
    if (typeof obj.feedback !== 'string') obj.feedback = '';

    // 4. [correctAnswer letra]: "a", "B)", "c." → contenido de options[idx]
    if (
      typeof obj.correctAnswer === 'string' &&
      Array.isArray(obj.options) &&
      obj.options.length >= 2
    ) {
      const m = obj.correctAnswer.trim().match(/^([a-d])[).]?$/i);
      if (m) {
        const idx = m[1].toLowerCase().charCodeAt(0) - 97; // a→0, b→1...
        const target: unknown = obj.options[idx]; // `unknown`: el typeof de abajo lo acota a string
        if (typeof target === 'string' && target.trim().length > 0) {
          obj.correctAnswer = target;
        }
      }
    }
    return obj;
  }

  // [Desenvolver formas comunes]: array directo, {"questions":[...]}, {"pregunta1":{...},"pregunta2":{...}} u objeto-pregunta único | [Patrón]: Unwrap | [Principio]: Robustez
  private unwrapQuestions(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    const obj = value as Record<string, unknown>;
    // a) Alguna propiedad es un array de objetos (ej. {"questions": [...]})
    for (const v of Object.values(obj)) {
      if (
        Array.isArray(v) &&
        v.some((e) => e !== null && typeof e === 'object')
      ) {
        return v;
      }
    }
    // b) Mapa de preguntas: {"pregunta1": {...}, "pregunta2": {...}}
    const nested = Object.values(obj).filter(
      (v): v is Record<string, unknown> =>
        v !== null && typeof v === 'object' && !Array.isArray(v),
    );
    if (nested.length > 0 && nested.every((v) => typeof v.text === 'string')) {
      return nested;
    }
    // c) Objeto único que ya es una pregunta
    if (typeof obj.text === 'string') return [obj];
    return [];
  }

  // [Limpieza de ruido]: quita bloques de razonamiento <think>...</think> (Qwen3) y cercas ```json | [Principio]: Robustez
  private stripNoise(raw: string): string {
    let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // [Cerca markdown]: si existe, quédate con su contenido
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1];
    return text;
  }

  // [Extracción balanceada]: primer bloque open..close balanceado, ignorando llaves/corchetes dentro de strings | [Patrón]: Bracket Matching
  private extractBalanced(
    text: string,
    open: string,
    close: string,
  ): string | null {
    const start = text.indexOf(open);
    if (start === -1) return null;
    let depth = 0;
    let inStr = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  // [Recolección de objetos sueltos]: escanea todos los { ... } balanceados de nivel superior y los parsea individualmente | [Patrón]: Object Scavenger | [Principio]: Robustez
  private extractObjects(text: string): unknown[] {
    const result: unknown[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const slice = text.slice(cursor);
      const objStr = this.extractBalanced(slice, '{', '}');
      if (!objStr) break;
      try {
        result.push(JSON.parse(objStr));
      } catch {
        // [Objeto corrupto]: lo ignoramos y seguimos buscando | [Patrón]: Skip-and-continue
      }
      cursor += slice.indexOf(objStr) + objStr.length;
    }
    return result;
  }

  // [Validación schema mínimo]: previene crashes downstream por output mal formado | [Patrón]: Type Guard | [Principio]: Robustez
  protected isValidRawQuestion(q: unknown): q is RawAIQuestion {
    if (!q || typeof q !== 'object') return false;
    const obj = q as Record<string, unknown>;
    // [Campos comunes a todos los tipos]: text, correctAnswer, explanation, feedback | [Principio]: DRY
    const commonValid =
      typeof obj.text === 'string' &&
      obj.text.trim().length > 0 &&
      typeof obj.type === 'string' &&
      (obj.type === 'multiple_choice' ||
        obj.type === 'true_false' ||
        obj.type === 'open_answer') &&
      typeof obj.correctAnswer === 'string' &&
      obj.correctAnswer.trim().length > 0 &&
      typeof obj.explanation === 'string' &&
      typeof obj.feedback === 'string';
    if (!commonValid) return false;

    // [Rechazo de eco del ejemplo]: el modelo copió los marcadores del prompt o el
    // ejemplo legacy ("capital de Francia") en vez de generar sobre el tema | [Patrón]: Quality Gate
    if (this.isExampleEcho(obj.text as string)) {
      this.logger.warn(
        `Pregunta descartada: eco del ejemplo del prompt ("${(obj.text as string).trim().slice(0, 60)}")`,
      );
      return false;
    }

    // [open_answer]: sin opciones; basta una respuesta modelo con contenido real | [Patrón]: Type-specific Gate
    if (obj.type === 'open_answer') {
      return !this.isPlaceholderLabel(obj.correctAnswer as string);
    }

    // [multiple_choice / true_false]: requieren options válidas | [Patrón]: Type-specific Gate
    const optionsValid =
      Array.isArray(obj.options) &&
      obj.options.length >= 2 &&
      obj.options.every((o) => typeof o === 'string' && o.trim().length > 0);
    if (!optionsValid) return false;

    // [Rechazo de placeholders]: descarta preguntas donde el modelo copió etiquetas genéricas ("Opción A", "A)", "Respuesta 1") en vez del contenido real | [Patrón]: Quality Gate
    if (obj.type === 'multiple_choice') {
      const values = [
        ...(obj.options as string[]),
        obj.correctAnswer as string,
      ];
      if (values.some((v) => this.isPlaceholderLabel(v))) {
        this.logger.warn(
          `Pregunta descartada: contiene etiquetas genéricas en lugar de contenido real ("${(obj.correctAnswer as string).trim()}")`,
        );
        return false;
      }
    }
    return true;
  }

  // [Detector de placeholders]: "Opción A", "Opcion B", "A)", "A.", "Respuesta 1", letras/números sueltos,
  // y marcadores del schema sin sustituir ("<respuesta correcta>", "<distractor 1>") | [Principio]: Robustez
  private isPlaceholderLabel(value: string): boolean {
    const v = value.trim();
    return (
      /^(opci[oó]n|respuesta|answer|option)\s*[a-d0-9]?$/i.test(v) ||
      /^[a-d0-9][).]?$/i.test(v) ||
      /^<.*>$/.test(v) ||
      /^(respuesta correcta|distractor)\s*\d*$/i.test(v)
    );
  }

  // [Detector de eco del ejemplo]: enunciados que copian los marcadores del schema o
  // los ejemplos concretos legacy del prompt | [Principio]: Robustez
  private isExampleEcho(text: string): boolean {
    const v = text.trim().toLowerCase();
    return (
      /^<.*>$/.test(v) ||
      /sobre el tema>?$/.test(v) ||
      /^<?(pregunta (concreta|de desarrollo)|afirmaci[oó]n verificable)/.test(
        v,
      ) ||
      v.includes('capital de francia')
    );
  }

  // [Mapeo raw → dominio]: normaliza tipos, asegura correctAnswer ∈ options | [Patrón]: Adapter
  protected normalize(
    raw: RawAIQuestion,
    options: GenerateAIQuestionsOptions,
  ): AIGeneratedQuestion {
    const type =
      raw.type === 'true_false'
        ? QuestionType.TRUE_FALSE
        : raw.type === 'open_answer'
          ? QuestionType.OPEN_ANSWER
          : QuestionType.MULTIPLE_CHOICE;
    // [open_answer sin opciones]: array vacío; el resto asegura correctAnswer ∈ options | [Patrón]: Self-healing
    const rawOpts = raw.options ?? [];
    const opts =
      type === QuestionType.OPEN_ANSWER
        ? []
        : rawOpts.includes(raw.correctAnswer)
          ? rawOpts
          : [raw.correctAnswer, ...rawOpts];
    return {
      text: raw.text.trim(),
      type,
      options: opts.map((o) => o.trim()),
      correctAnswer: raw.correctAnswer.trim(),
      difficulty: options.difficulty ?? Difficulty.MEDIUM,
      category: options.category ?? Category.GENERAL,
      language: options.language ?? DEFAULT_LANGUAGE,
      explanation: raw.explanation.trim(),
      feedback: raw.feedback.trim(),
      provider: this.id,
    };
  }
}
