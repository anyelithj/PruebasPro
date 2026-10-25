import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ScoreController } from '../../../src/modules/score/presentation/score.controller';
import { GetLeaderboardUseCase } from '../../../src/modules/score/application/use-cases/get-leaderboard.use-case';
import { GetUserHistoryUseCase } from '../../../src/modules/score/application/use-cases/get-user-history.use-case';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';
import { GLOBAL_VALIDATION_OPTIONS } from '../../../src/shared/pipes/validation.pipe';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
// [Suite Integration ScoreController – GET /score/leaderboard]: rankings públicos, paginación por `limit`

describe('ScoreController GET /score/leaderboard (integration)', () => {
  let app: INestApplication;
  let leaderboardUC: { execute: jest.Mock };

  beforeAll(async () => {
    leaderboardUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ScoreController],
      providers: [
        { provide: GetLeaderboardUseCase, useValue: leaderboardUC },
        { provide: GetUserHistoryUseCase, useValue: { execute: jest.fn() } },
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
    leaderboardUC.execute.mockReset();
  });

  it('200 + entries ranked y mapeadas con `rank` 1..N', async () => {
    leaderboardUC.execute.mockResolvedValue([
      { userId: 'a', displayName: 'Ana', totalPoints: 200, quizzesCompleted: 5, avgAccuracy: 0.9 },
      { userId: 'b', displayName: 'Bob', totalPoints: 150, quizzesCompleted: 4, avgAccuracy: 0.8 },
    ]);

    const res = await request(app.getHttpServer()).get('/score/leaderboard').expect(200);

    expect(res.body.data.entries).toEqual([
      expect.objectContaining({ rank: 1, userId: 'a', totalPoints: 200 }),
      expect.objectContaining({ rank: 2, userId: 'b', totalPoints: 150 }),
    ]);
    // [Sin ?limit]: el controller envía default 10 al use case (+ months/section sin valor → undefined)
    expect(leaderboardUC.execute).toHaveBeenCalledWith(10, undefined, undefined);
  });

  it('respeta el ?limit pasado por querystring', async () => {
    leaderboardUC.execute.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/score/leaderboard?limit=5').expect(200);
    expect(leaderboardUC.execute).toHaveBeenCalledWith(5, undefined, undefined);
  });

  it('200 con entries=[] cuando no hay datos', async () => {
    leaderboardUC.execute.mockResolvedValue([]);
    const res = await request(app.getHttpServer()).get('/score/leaderboard').expect(200);
    expect(res.body.data).toEqual({ entries: [] });
  });
});
