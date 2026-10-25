import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUIZ_REPOSITORY } from '../../domain/interfaces/quiz.repository.interface';
import type { IQuizRepository } from '../../domain/interfaces/quiz.repository.interface';
import {
  QUIZ_CREATED_EVENT,
  QuizCreatedEvent,
} from '../../domain/events/quiz-created.event';
import { CreateQuizDto } from '../dtos/create-quiz.dto';
import { Quiz } from '../../domain/entities/quiz.entity';
import { DEFAULT_LANGUAGE } from '../../domain/value-objects/language.vo';
// [Use Case CreateQuiz]: persiste quiz + preguntas + emite evento | [Patrón]: Command + Use Case | [Principio]: SRP + DIP | [Paradigma]: POO

@Injectable()
export class CreateQuizUseCase {
  private readonly logger = new Logger(CreateQuizUseCase.name);

  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
    private readonly events: EventEmitter2,
  ) {}

  // [execute]: punto único de entrada | [Principio]: SRP
  async execute(dto: CreateQuizDto, authorId: string): Promise<Quiz> {
    // [Resolución idioma a nivel quiz]: se aplica como default a cada pregunta sin override | [Principio]: DRY
    const quizLanguage = dto.language ?? DEFAULT_LANGUAGE;

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
