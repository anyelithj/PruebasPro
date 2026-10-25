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
// [Suite Integration ScoreController – GET /score/history]: la "submission" de puntaje vive en /quiz/session/:id/answer; aquí cubrimos la consulta de historial que es donde el score se materializa para el cliente.

const USER_UUID = 'd4444444-4444-4444-8444-444444444444';

describe('ScoreController GET /score/history (integration)', () => {
  let app: INestApplication;
  let historyUC: { execute: jest.Mock };

  beforeAll(async () => {
    historyUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ScoreController],
      providers: [
        { provide: GetUserHistoryUseCase, useValue: historyUC },
        { provide: GetLeaderboardUseCase, useValue: { execute: jest.fn() } },
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
    historyUC.execute.mockReset();
  });

  it('GET /score/history sin params usa default 20 y el userId del JWT', async () => {
    historyUC.execute.mockResolvedValue([{ sessionId: 's1', points: 10 }]);

    const res = await request(app.getHttpServer()).get('/score/history').expect(200);

    expect(res.body.data).toEqual([{ sessionId: 's1', points: 10 }]);
    expect(historyUC.execute).toHaveBeenCalledWith('u1', 20, undefined);
  });

  it('GET /score/history?limit=3 parsea el límite', async () => {
    historyUC.execute.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/score/history?limit=3').expect(200);
    expect(historyUC.execute).toHaveBeenCalledWith('u1', 3, undefined);
  });

  it('GET /score/history/:userId con UUID válido invoca el UC con ese id', async () => {
    historyUC.execute.mockResolvedValue([]);
    await request(app.getHttpServer()).get(`/score/history/${USER_UUID}`).expect(200);
    expect(historyUC.execute).toHaveBeenCalledWith(USER_UUID, 20, undefined);
  });

  it('GET /score/history/:userId con id no-UUID → 400 (ParseUUIDPipe)', async () => {
    await request(app.getHttpServer()).get('/score/history/not-uuid').expect(400);
    expect(historyUC.execute).not.toHaveBeenCalled();
  });
});
