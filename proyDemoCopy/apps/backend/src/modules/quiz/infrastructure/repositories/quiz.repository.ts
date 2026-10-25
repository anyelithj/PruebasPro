import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from '../../domain/entities/quiz.entity';
import { Question } from '../../domain/entities/question.entity';
import {
  QuizSession,
  SessionAnswer,
  SessionStatus,
} from '../../domain/entities/quiz-session.entity';
import type {
  CreateQuizInput,
  IQuizRepository,
  ListQuizzesOptions,
  PaginatedQuizzes,
} from '../../domain/interfaces/quiz.repository.interface';
import { DEFAULT_LANGUAGE } from '../../domain/value-objects/language.vo';
// [Adapter TypeORM]: implementa IQuizRepository | [Patron]: Repository + Adapter (Hexagonal) | [Principio]: DIP | [Paradigma]: POO

@Injectable()
export class QuizRepository implements IQuizRepository {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(QuizSession)
    private readonly sessionRepo: Repository<QuizSession>,
  ) {}

  // ===== Quiz =====
  async createQuiz(input: CreateQuizInput): Promise<Quiz> {
    // [Resolución idioma]: si no viene del input, usar default | [Principio]: DRY
    const quizLanguage = input.language ?? DEFAULT_LANGUAGE;
    // [Transaccional via cascade]: las preguntas se insertan en la misma operacion
    const quiz = this.quizRepo.create({
      title: input.title,
      description: input.description,
      category: input.category,
      difficulty: input.difficulty,
      language: quizLanguage,
      authorId: input.authorId,
      source: input.source ?? 'custom',
      timePerQuestionSeconds: input.timePerQuestionSeconds ?? 30,
      isPublished: input.isPublished ?? false,
    });
    const saved = await this.quizRepo.save(quiz);

    // [Persistir preguntas]: relaciona y guarda; cada Question hereda idioma del Quiz si no trae override
    const questions = input.questions.map((q, idx) =>
      this.questionRepo.create({
        ...q,
        quizId: saved.id,
        position: idx,
        language: q.language ?? quizLanguage,
      }),
    );
    await this.questionRepo.save(questions);
    saved.questions = questions;
    return saved;
  }

  async findQuizById(id: string, withQuestions = true): Promise<Quiz | null> {
    return this.quizRepo.findOne({
      where: { id },
      relations: withQuestions ? ['questions'] : [],
      order: withQuestions ? { questions: { position: 'ASC' } } : undefined,
    });
  }

  async listQuizzes(options: ListQuizzesOptions): Promise<PaginatedQuizzes> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 12;
    const qb = this.quizRepo
      .createQueryBuilder('q')
      .loadRelationCountAndMap('q.questionsCount', 'q.questions');

    if (options.publishedOnly)
      qb.andWhere('q.isPublished = :pub', { pub: true });
    if (options.category)
      qb.andWhere('q.category = :cat', { cat: options.category });
    if (options.difficulty)
      qb.andWhere('q.difficulty = :diff', { diff: options.difficulty });
    if (options.authorId)
      qb.andWhere('q.authorId = :uid', { uid: options.authorId });

    qb.orderBy('q.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async updateQuiz(id: string, partial: Partial<Quiz>): Promise<Quiz> {
    const merged = await this.quizRepo.preload({ id, ...partial });
    if (!merged) throw new Error(`Quiz ${id} not found for update`);
    return this.quizRepo.save(merged);
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.quizRepo.delete({ id });
  }

  // [replaceQuestions]: borra todas + inserta nuevo set + ajusta position | [Patrón]: Full Replace
  async replaceQuestions(
    quizId: string,
    questions: Omit<Question, 'id' | 'quiz' | 'quizId'>[],
  ): Promise<Quiz> {
    const quiz = await this.quizRepo.findOne({ where: { id: quizId } });
    if (!quiz) throw new Error(`Quiz ${quizId} not found`);
    // [Borrado masivo]: cascade en relación; explícito para portabilidad
    await this.questionRepo.delete({ quizId });
    const newOnes = questions.map((q, idx) =>
      this.questionRepo.create({
        ...q,
        quizId,
        position: idx,
        language: q.language ?? quiz.language,
      }),
    );
    await this.questionRepo.save(newOnes);
    return this.findQuizById(quizId, true) as Promise<Quiz>;
  }

  // ===== Session =====
  async createSession(userId: string, quizId: string): Promise<QuizSession> {
    const entity = this.sessionRepo.create({
      userId,
      quizId,
      status: SessionStatus.IN_PROGRESS,
      answers: [],
      totalScore: 0,
      correctCount: 0,
    });
    return this.sessionRepo.save(entity);
  }

  async findSessionById(id: string): Promise<QuizSession | null> {
    return this.sessionRepo.findOne({ where: { id } });
  }

  async appendSessionAnswer(
    sessionId: string,
    answer: SessionAnswer,
  ): Promise<QuizSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.answers = [...session.answers, answer];
    return this.sessionRepo.save(session);
  }

  async finalizeSession(
    sessionId: string,
    status: SessionStatus,
    totalScore: number,
    correctCount: number,
  ): Promise<QuizSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.status = status;
    session.totalScore = totalScore;
    session.correctCount = correctCount;
    session.completedAt = new Date();
    return this.sessionRepo.save(session);
  }

  async listSessionsByUser(userId: string, limit = 20): Promise<QuizSession[]> {
    return this.sessionRepo.find({
      where: { userId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }
}
