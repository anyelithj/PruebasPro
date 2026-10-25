import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../../shared/decorators/current-user.decorator';
import { Public } from '../../../shared/decorators/public.decorator';
import { GetLeaderboardUseCase } from '../application/use-cases/get-leaderboard.use-case';
import { GetUserHistoryUseCase } from '../application/use-cases/get-user-history.use-case';
import { LeaderboardResponseDto } from '../application/dtos/leaderboard-response.dto';
import { parsePeriodMonths } from '../../../shared/utils/period.util';
// [Controller Score]: lecturas de leaderboard + historial | [Patron]: Controller + Facade | [Principio]: SRP

@ApiTags('score')
@ApiBearerAuth()
@Controller('score')
export class ScoreController {
  constructor(
    private readonly leaderboardUC: GetLeaderboardUseCase,
    private readonly historyUC: GetUserHistoryUseCase,
  ) {}

  // [GET /score/leaderboard]: publico (no requiere auth para landing) | [Decorator]: @Public
  @Public()
  @Get('leaderboard')
  @ApiOperation({ summary: 'Top N users by total points (cached 60s)' })
  async leaderboard(
    @Query('limit') limit?: string,
    @Query('months') months?: string,
    @Query('section') section?: string,
  ): Promise<LeaderboardResponseDto> {
    const data = await this.leaderboardUC.execute(
      limit ? parseInt(limit, 10) : 10,
      parsePeriodMonths(months),
      section || undefined,
    );
    const entries = data.map((e, idx) => ({
      rank: idx + 1,
      userId: e.userId,
      displayName: e.displayName,
      totalPoints: e.totalPoints,
      quizzesCompleted: e.quizzesCompleted,
      avgAccuracy: e.avgAccuracy,
    }));
    return { entries };
  }

  // [GET /score/history]: del usuario actual
  @Get('history')
  @ApiOperation({ summary: 'Current user score history' })
  async myHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('months') months?: string,
  ) {
    return this.historyUC.execute(
      user.sub,
      limit ? parseInt(limit, 10) : 20,
      parsePeriodMonths(months),
    );
  }

  // [GET /score/history/:userId]: historial de otro usuario (publico hoy)
  @Get('history/:userId')
  @ApiOperation({ summary: 'User score history by id' })
  async history(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: string,
    @Query('months') months?: string,
  ) {
    return this.historyUC.execute(
      userId,
      limit ? parseInt(limit, 10) : 20,
      parsePeriodMonths(months),
    );
  }
}
