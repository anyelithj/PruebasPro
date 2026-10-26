import { Category } from '../value-objects/category.vo';
import { Difficulty } from '../value-objects/difficulty.vo';
import { Language } from '../value-objects/language.vo';
import { QuestionType } from '../entities/question.entity';
import { AIProvider } from '../value-objects/ai-provider.vo';
// [Port Generador AI]: contrato Domain → Infrastructure para LLMs locales (Ollama) | [Patrón]: Port (Hexagonal) + Strategy | [Principio]: DIP + ISP + OCP | [Paradigma]: POO

// [Token DI]: usado con @Inject(AI_QUESTION_PROVIDER) o resuelto por la factory | [Patrón]: Service Locator (Nest DI)
export const AI_QUESTION_PROVIDER = Symbol('AI_QUESTION_PROVIDER');

// [Pregunta generada por IA]: forma normalizada agnóstica del proveedor + explicación/feedback pedagógico | [Principio]: SRP + ISP
export interface AIGeneratedQuestion {
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  category: Category;
  // [Idioma del contenido]: por defecto español | [Principio]: SRP
  language: Language;
  // [explanation]: razón por la que la respuesta es correcta, en idioma destino | [Principio]: SRP
  explanation: string;
  // [feedback]: orientación pedagógica genérica al estudiante (cómo abordar el tema, no depende de la respuesta del usuario) | [Principio]: SRP
  feedback: string;
  // [provider]: trazabilidad del motor que generó la pregunta | [Patrón]: Provenance
  provider: AIProvider;
}

// [Opciones de generación]: parametrizables — el topic es el driver principal | [Principio]: ISP
export interface GenerateAIQuestionsOptions {
  amount: number;
  // [topic]: tema libre académico (ej: "fotosíntesis", "ecuaciones de segundo grado")
  topic: string;
  category?: Category;
  difficulty?: Difficulty;
  type?: QuestionType;
  language?: Language;
}

// [Contrato motor]: implementado por adapters (QwenProvider, MistralProvider, futuros) | [Patrón]: Strategy (Port) | [Principio]: OCP — abierto a nuevos providers
export interface IAIQuestionProvider {
  // [id]: identificador del provider concreto. Usado por la factory para enrutar selección | [Patrón]: Self-describing | [Principio]: SRP
  readonly id: AIProvider;
  // [modelTag · 2026-10-24]: tag de Ollama que usa el motor (opcional, `?` TS) → la factory detecta motores que apuntan al MISMO modelo (elegir otro motor no cambiaría nada)
  readonly modelTag?: string;

  // [generateQuestions]: produce N preguntas coherentes en el idioma destino | [Principio]: SRP
  generateQuestions(
    options: GenerateAIQuestionsOptions,
  ): Promise<AIGeneratedQuestion[]>;
}
