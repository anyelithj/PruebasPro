import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUIZ_REPOSITORY } from '../../domain/interfaces/quiz.repository.interface';
import type { IQuizRepository } from '../../domain/interfaces/quiz.repository.interface';
import {
  QUIZ_COMPLETED_EVENT,
  QuizCompletedEvent,
} from '../../domain/events/quiz-completed.event';
import { SessionStatus } from '../../domain/entities/quiz-session.entity';
import { isExam, percentOf } from '../../domain/exam-rules';
import { EXAM_PASSED_EVENT, type ExamPassedEvent } from '../../domain/events/exam-passed.event';
// [Use Case EndSession]: cierra sesion + agrega totales + emite QuizCompleted | [Patron]: Command | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class EndSessionUseCase {
  private readonly logger = new Logger(EndSessionUseCase.name);

  constructor(
    @Inject(QUIZ_REPOSITORY) private readonly repo: IQuizRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(sessionId: string, userId: string, abandoned = false) {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.userId !== userId) {
      throw new ForbiddenException('Session does not belong to current user');
    }
    if (session.status !== SessionStatus.IN_PROGRESS) return session;

    const totalScore = session.answers.reduce((s, a) => s + a.score, 0);
    const correctCount = session.answers.filter((a) => a.isCorrect).length;

    const quiz = await this.repo.findQuizById(session.quizId, true);
    const totalQuestions = session.questionIds?.length ?? quiz?.questions?.length ?? 0;
    // [2026-11-06 · Exámenes]: % sobre las preguntas del intento (sin contestar = fallo) · abandonar cuenta como suspenso
    const exam = quiz && isExam(quiz.kind);
    const percent = percentOf(correctCount, totalQuestions);
    const passed = exam ? !abandoned && percent >= quiz.passScore : null;

    const finalized = await (exam
      ? this.repo.finalizeSession(
          sessionId,
          abandoned ? SessionStatus.ABANDONED : SessionStatus.COMPLETED,
          totalScore,
          correctCount,
          { percent, passed },
        )
      : this.repo.finalizeSession(
          sessionId,
          abandoned ? SessionStatus.ABANDONED : SessionStatus.COMPLETED,
          totalScore,
          correctCount,
        ));
    if (passed)
      this.events.emit(EXAM_PASSED_EVENT, {
        userId,
        quizId: quiz!.id,
        courseId: quiz!.kind === 'final' ? quiz!.courseId : null,
        percent,
      } satisfies ExamPassedEvent);

    if (!abandoned) {
      this.events.emit(
        QUIZ_COMPLETED_EVENT,
        new QuizCompletedEvent(
          finalized.id,
          finalized.userId,
          finalized.quizId,
          totalScore,
          correctCount,
          totalQuestions,
        ),
      );
      this.logger.log(
        `Session completed: ${finalized.id} score=${totalScore} ${correctCount}/${totalQuestions}`,
      );
    }
    return finalized;
  }
}
