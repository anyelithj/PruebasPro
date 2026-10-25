import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QuizController } from '../../../src/modules/quiz/presentation/quiz.controller';
import { CreateQuizUseCase } from '../../../src/modules/quiz/application/use-cases/create-quiz.use-case';
import { GetQuizUseCase } from '../../../src/modules/quiz/application/use-cases/get-quiz.use-case';
import { ListQuizzesUseCase } from '../../../src/modules/quiz/application/use-cases/list-quizzes.use-case';
import { GenerateAIQuestionsUseCase } from '../../../src/modules/quiz/application/use-cases/generate-ai-questions.use-case';
import { StartSessionUseCase } from '../../../src/modules/quiz/application/use-cases/start-session.use-case';
import { SubmitAnswerUseCase } from '../../../src/modules/quiz/application/use-cases/submit-answer.use-case';
import { EndSessionUseCase } from '../../../src/modules/quiz/application/use-cases/end-session.use-case';
import { ListMyHistoryUseCase } from '../../../src/modules/quiz/application/use-cases/list-my-history.use-case';
import { QUIZ_REPOSITORY } from '../../../src/modules/quiz/domain/interfaces/quiz.repository.interface';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';
import { GLOBAL_VALIDATION_OPTIONS } from '../../../src/shared/pipes/validation.pipe';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
// [Suite Integration QuizController – sesiones]: start/submit/end via supertest

// [UUID v4 válidos]: variante 8/9/a/b en posición y (4to grupo, primer char) | [Fix]: class-validator @IsUUID rechaza variantes inválidas
const QUIZ_ID = 'a1111111-1111-4111-8111-111111111111';
const SESS_ID = 'b2222222-2222-4222-8222-222222222222';
const QUESTION_ID = 'c3333333-3333-4333-8333-333333333333';

describe('QuizController /quiz/:id/session etc. (integration)', () => {
  let app: INestApplication;
  let startUC: { execute: jest.Mock };
  let submitUC: { execute: jest.Mock };
  let endUC: { execute: jest.Mock };

  beforeAll(async () => {
    startUC = { execute: jest.fn() };
    submitUC = { execute: jest.fn() };
    endUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [
        { provide: StartSessionUseCase, useValue: startUC },
        { provide: SubmitAnswerUseCase, useValue: submitUC },
        { provide: EndSessionUseCase, useValue: endUC },
        { provide: ListMyHistoryUseCase, useValue: { execute: jest.fn() } },
        { provide: CreateQuizUseCase, useValue: { execute: jest.fn() } },
        { provide: GetQuizUseCase, useValue: { execute: jest.fn() } },
        { provide: ListQuizzesUseCase, useValue: { execute: jest.fn() } },
        { provide: GenerateAIQuestionsUseCase, useValue: { execute: jest.fn() } },
        {
          provide: QUIZ_REPOSITORY,
          useValue: {
            findQuizById: jest.fn(),
            deleteQuiz: jest.fn(),
            updateQuiz: jest.fn(),
            replaceQuestions: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: any, _res: any, next: any) => {
      req.user = { sub: 'u1', email: 'u@neuroedu.ia', role: Role.USER };
      next();
    });
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_OPTIONS));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    startUC.execute.mockReset();
    submitUC.execute.mockReset();
    endUC.execute.mockReset();
  });

  it('POST /quiz/:id/session → 201 + envelope', async () => {
    startUC.execute.mockResolvedValue({ id: SESS_ID, quizId: QUIZ_ID, status: 'active' });

    const res = await request(app.getHttpServer()).post(`/quiz/${QUIZ_ID}/session`).expect(201);

    expect(res.body).toMatchObject({
      statusCode: 201,
      data: { id: SESS_ID, status: 'active' },
    });
    expect(startUC.execute).toHaveBeenCalledWith('u1', QUIZ_ID);
  });

  it('POST /quiz/:id/session 404 si el use case lanza NotFoundException', async () => {
    startUC.execute.mockRejectedValue(new NotFoundException('Quiz not found'));
    await request(app.getHttpServer()).post(`/quiz/${QUIZ_ID}/session`).expect(404);
  });

  it('POST /quiz/session/:sessionId/answer → propaga DTO + token Bearer', async () => {
    submitUC.execute.mockResolvedValue({ isCorrect: true, score: 10 });

    const res = await request(app.getHttpServer())
      .post(`/quiz/session/${SESS_ID}/answer`)
      .set('Authorization', 'Bearer test-jwt')
      .send({ questionId: QUESTION_ID, userAnswer: 'B', timeTakenMs: 1500 })
      .expect(201);

    expect(res.body.data).toMatchObject({ isCorrect: true, score: 10 });
    expect(submitUC.execute).toHaveBeenCalledWith(
      SESS_ID,
      'u1',
      expect.objectContaining({ questionId: QUESTION_ID, userAnswer: 'B', timeTakenMs: 1500 }),
      'test-jwt',
    );
  });

  it('POST /quiz/session/:sessionId/answer 400 si questionId no es UUID', async () => {
    await request(app.getHttpServer())
      .post(`/quiz/session/${SESS_ID}/answer`)
      .send({ questionId: 'not-uuid', userAnswer: 'B' })
      .expect(400);
    expect(submitUC.execute).not.toHaveBeenCalled();
  });

  it('POST /quiz/session/:sessionId/end → flag abandon=true', async () => {
    endUC.execute.mockResolvedValue({ id: SESS_ID, status: 'abandoned' });

    await request(app.getHttpServer())
      .post(`/quiz/session/${SESS_ID}/end?abandon=true`)
      .expect(201);

    expect(endUC.execute).toHaveBeenCalledWith(SESS_ID, 'u1', true);
  });
});
