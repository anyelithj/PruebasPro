import { INestApplication, ValidationPipe } from '@nestjs/common';
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
// [Suite Integration QuizController – listado/detalle]: pipeline HTTP con UC mockeados, sin DB

const UUID_OK = 'a1111111-1111-4111-8111-111111111111';

describe('QuizController GET /quiz, GET /quiz/:id (integration)', () => {
  let app: INestApplication;
  let listUC: { execute: jest.Mock };
  let getUC: { execute: jest.Mock };

  beforeAll(async () => {
    listUC = { execute: jest.fn() };
    getUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [
        { provide: ListQuizzesUseCase, useValue: listUC },
        { provide: GetQuizUseCase, useValue: getUC },
        { provide: CreateQuizUseCase, useValue: { execute: jest.fn() } },
        { provide: GenerateAIQuestionsUseCase, useValue: { execute: jest.fn() } },
        { provide: StartSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: SubmitAnswerUseCase, useValue: { execute: jest.fn() } },
        { provide: EndSessionUseCase, useValue: { execute: jest.fn() } },
        { provide: ListMyHistoryUseCase, useValue: { execute: jest.fn() } },
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
    // [Middleware test]: inyecta req.user (sustituye al JwtAuthGuard global, no cargado aquí)
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
    listUC.execute.mockReset();
    getUC.execute.mockReset();
  });

  it('GET /quiz delega al use case con paginación parseada', async () => {
    listUC.execute.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });

    const res = await request(app.getHttpServer())
      .get('/quiz?page=2&limit=5&publishedOnly=true')
      .expect(200);

    expect(res.body.data).toMatchObject({ page: 2, limit: 5 });
    expect(listUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, publishedOnly: true }),
    );
  });

  it('GET /quiz acepta publishedOnly=false (TEACHER+ ve borradores)', async () => {
    listUC.execute.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });

    await request(app.getHttpServer()).get('/quiz?publishedOnly=false').expect(200);

    expect(listUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ publishedOnly: false }),
    );
  });

  it('GET /quiz/:id devuelve detalle con preguntas', async () => {
    getUC.execute.mockResolvedValue({ id: UUID_OK, title: 'Quiz X', questions: [] });

    const res = await request(app.getHttpServer()).get(`/quiz/${UUID_OK}`).expect(200);

    expect(res.body.data).toMatchObject({ id: UUID_OK, title: 'Quiz X' });
    expect(getUC.execute).toHaveBeenCalledWith(UUID_OK, true);
  });

  it('GET /quiz/:id devuelve 400 cuando el id no es UUID (ParseUUIDPipe)', async () => {
    await request(app.getHttpServer()).get('/quiz/not-a-uuid').expect(400);
    expect(getUC.execute).not.toHaveBeenCalled();
  });
});
