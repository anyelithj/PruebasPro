import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { examMinutes, PASS_SCORE } from '../../domain/exam-rules';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertUniqueTitle } from '../../../../shared/application/unique-title'; // [2026-10-28]: regla anti-duplicados compartida (DRY)
import { QUIZ_REPOSITORY } from '../../domain/interfaces/quiz.repository.interface';
import type { IQuizRepository } from '../../domain/interfaces/quiz.repository.interface';
import {
  QUIZ_CREATED_EVENT,
  QuizCreatedEvent,
} from '../../domain/events/quiz-created.event';
import { CreateQuizDto } from '../dtos/create-quiz.dto';
import { Quiz } from '../../domain/entities/quiz.entity';
import { DEFAULT_LANGUAGE } from '../../domain/value-objects/language.vo';
import { Category } from '../../domain/value-objects/category.vo';
import { Difficulty } from '../../domain/value-objects/difficulty.vo';
// [Use Case CreateQuiz]: persiste quiz + preguntas + emite evento | [Patrón]: Command + Use Case | [Principio]: SRP + DIP | [Paradigma]: POO

@Injectable()
export class CreateQuizUseCase {
  private readonly logger = new Logger(CreateQuizUseCase.name);

  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
    private readonly events: EventEmitter2,
    @InjectRepository(Quiz) private readonly quizzes: Repository<Quiz>, // [2026-10-28]: lectura ligera id + título para la regla anti-duplicados
  ) {}

  // [assertUnique · Fix 2026-10-28]: ningún examen se repite (título normalizado) en el mismo idioma + dificultad + categoría → 409 | público: lo reutiliza PATCH /quiz/:id (DRY)
  assertUnique(
    title: string,
    scope: Pick<Quiz, 'language' | 'difficulty' | 'category'>,
    excludeId?: string,
  ): Promise<void> {
    return assertUniqueTitle(
      this.quizzes,
      title,
      { language: scope.language, difficulty: scope.difficulty, category: scope.category },
      { label: 'un examen', language: scope.language, extra: `(${scope.category}, ${scope.difficulty})` },
      excludeId,
    );
  }

  // [execute]: punto único de entrada | [Principio]: SRP
  async execute(dto: CreateQuizDto, authorId: string): Promise<Quiz> {
    // [Resolución idioma a nivel quiz]: se aplica como default a cada pregunta sin override | [Principio]: DRY
    const quizLanguage = dto.language ?? DEFAULT_LANGUAGE;
    // [Fix 2026-10-28 · Sin duplicados]: mismos valores por defecto que la entidad cuando el DTO no trae categoría o dificultad
    await this.assertUnique(dto.title.trim(), {
      language: quizLanguage,
      difficulty: dto.difficulty ?? Difficulty.MEDIUM,
      category: dto.category ?? Category.GENERAL,
    });

    // [2026-11-09]: un curso tiene UN examen final
    if (dto.courseId && (await this.repo.findExam({ kind: 'final', courseId: dto.courseId })))
      throw new ConflictException('Este curso ya tiene examen final: edítalo desde Gestión → Exámenes.');

    // [2026-11-10]: examen de nivel = uno por idioma + nivel MCER
    const level = !dto.courseId && dto.kind === 'level';
    if (level && !dto.cefrLevel) throw new BadRequestException('El examen de nivel necesita su nivel MCER (A1–C2).');
    if (level && (await this.repo.findExam({ kind: 'level', language: quizLanguage, cefrLevel: dto.cefrLevel! })))
      throw new ConflictException(`Ya existe el examen de nivel ${dto.cefrLevel} de este idioma: edítalo desde Gestión → Exámenes.`);

    // [Asignar position]: si no viene del cliente, derivar del orden del array
    const questions = dto.questions.map((q, idx) => ({
      ...q,
      position: idx,
      // [Override por pregunta]: si la pregunta trae idioma propio se respeta, sino hereda del quiz | [Patrón]: Default Policy
      language: q.language ?? quizLanguage,
      timeLimitSeconds: q.timeLimitSeconds,
    }));

    const quiz = await this.repo.createQuiz({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      category: dto.category,
      difficulty: dto.difficulty,
      language: quizLanguage,
      authorId,
      source: 'custom',
      timePerQuestionSeconds: dto.timePerQuestionSeconds ?? 30,
      isPublished: dto.isPublished ?? false,
      ...(dto.courseId ? { exam: { kind: 'final' as const, courseId: dto.courseId, cefrLevel: dto.cefrLevel ?? null, passScore: PASS_SCORE, timeLimitMinutes: 0, questionsPerAttempt: 0 } } : {}),
      ...(level ? { exam: { kind: 'level' as const, courseId: null, cefrLevel: dto.cefrLevel!, passScore: PASS_SCORE, timeLimitMinutes: examMinutes(dto.cefrLevel), questionsPerAttempt: 0 } } : {}),
      // [Cast a Omit]: el DTO ya valida; añadimos position dentro del repo
      questions: questions,
    });

    this.events.emit(
      QUIZ_CREATED_EVENT,
      new QuizCreatedEvent(quiz.id, quiz.authorId, quiz.title),
    );
    this.logger.log(
      `Quiz created: ${quiz.id} by ${authorId} (lang=${quizLanguage})`,
    );

    return quiz;
  }
}
