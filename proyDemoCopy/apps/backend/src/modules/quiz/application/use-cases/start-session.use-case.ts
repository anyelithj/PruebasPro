import { finalExamUnlocked } from '../../domain/final-exam-gate';
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { attemptGate, expired, isExam, pickQuestions } from '../../domain/exam-rules';
import { SessionStatus } from '../../domain/entities/quiz-session.entity';
import { EndSessionUseCase } from './end-session.use-case';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUIZ_REPOSITORY } from '../../domain/interfaces/quiz.repository.interface';
import type { IQuizRepository } from '../../domain/interfaces/quiz.repository.interface';
import {
  QUIZ_STARTED_EVENT,
  QuizStartedEvent,
} from '../../domain/events/quiz-started.event';
import { QuizSession } from '../../domain/entities/quiz-session.entity';
// [Use Case StartSession]: crea sesion + emite QuizStarted | [Patron]: Command | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class StartSessionUseCase {
  private readonly logger = new Logger(StartSessionUseCase.name);

  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
    private readonly events: EventEmitter2,
    private readonly ends?: EndSessionUseCase, // [2026-11-06]: cierra intentos de examen con el tiempo agotado
    @InjectDataSource() private readonly db?: DataSource,
  ) {}

  async execute(userId: string, quizId: string): Promise<QuizSession> {
    const quiz = await this.repo.findQuizById(quizId, false);
    if (!quiz) throw new NotFoundException(`Quiz ${quizId} not found`);
    if (isExam(quiz.kind)) return this.startExam(userId, quiz);

    const session = await this.repo.createSession(userId, quizId);
    this.events.emit(
      QUIZ_STARTED_EVENT,
      new QuizStartedEvent(session.id, userId, quizId),
    );
    this.logger.log(`Session started: ${session.id} (user=${userId})`);
    return session;
  }

  // [startExam · 2026-11-06]: examen final (curso al 100 %) o de nivel → intento abierto con tiempo = se CONTINÚA (recargar no da otro intento)
  // intentos sin tiempo se cierran · 3 intentos, 10 min entre ellos, 24 h tras 3 suspensos · cada intento sortea sus preguntas
  private async startExam(userId: string, quiz: NonNullable<Awaited<ReturnType<IQuizRepository['findQuizById']>>>): Promise<QuizSession> {
    if (quiz.kind === 'final' && quiz.courseId && this.db) {
      if (!(await finalExamUnlocked(this.db, userId, quiz.courseId)))
        throw new ConflictException('Completa el 100 % del curso para presentar el examen final');
    }
    const now = new Date();
    const sessions = await this.repo.listAttempts(userId, quiz.id);
    for (const s of sessions.filter((x) => x.status === SessionStatus.IN_PROGRESS)) {
      if (!expired(s.startedAt, quiz.timeLimitMinutes, now)) return s;
      await this.ends?.execute(s.id, userId); // Tiempo agotado → se califica lo contestado
    }
    const done = (await this.repo.listAttempts(userId, quiz.id)).filter((s) => s.status !== SessionStatus.IN_PROGRESS);
    const gate = attemptGate(done.map((s) => ({ startedAt: s.startedAt, passed: s.passed })), now);
    if (!gate.ok)
      throw new ConflictException(
        gate.reason === 'passed'
          ? 'Ya aprobaste este examen'
          : `Podrás intentarlo de nuevo el ${gate.retryAt!.toLocaleString('es')}`,
      );
    const ids = ((await this.repo.findQuizById(quiz.id, true))?.questions ?? []).map((q) => q.id);
    const session = await this.repo.createSession(userId, quiz.id, pickQuestions(ids, quiz.questionsPerAttempt || ids.length));
    this.events.emit(QUIZ_STARTED_EVENT, new QuizStartedEvent(session.id, userId, quiz.id));
    return session;
  }
}
