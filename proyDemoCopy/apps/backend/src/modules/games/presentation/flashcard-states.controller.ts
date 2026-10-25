import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { AddFlashcardUseCase } from '../application/use-cases/add-flashcard.use-case';
import {
  GetDueFlashcardsUseCase,
  GetFlashcardUseCase,
} from '../application/use-cases/get-due-flashcards.use-case';
import { RemoveFlashcardUseCase } from '../application/use-cases/remove-flashcard.use-case';
import { ReviewFlashcardUseCase } from '../application/use-cases/review-flashcard.use-case';
// [Controller FlashcardStates · Sprint 8.5 · RF-99]: mazo de repetición espaciada — agregar, vencidas hoy, ver, repasar (SM-2) y quitar | [Patrón]: Thin Controller | [Principio]: SRP | [Paradigma]: POO + Decoradores

export class AddFlashcardBody {
  @IsUUID() entryId!: string;
}

export class ReviewFlashcardBody {
  @IsInt() @Min(0) @Max(5) quality!: number; // 0 = no lo recordé … 5 = perfecto
}

@ApiTags('games')
@ApiBearerAuth()
@Controller('games/flashcards')
export class FlashcardStatesController {
  constructor(
    private readonly add: AddFlashcardUseCase,
    private readonly due: GetDueFlashcardsUseCase,
    private readonly get: GetFlashcardUseCase,
    private readonly review: ReviewFlashcardUseCase,
    private readonly remove: RemoveFlashcardUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Agregar una palabra del banco al mazo' })
  addOne(@CurrentUser() u: JwtPayload, @Body() body: AddFlashcardBody) {
    return this.add.execute(u.sub, body.entryId);
  }

  @Get('due')
  @ApiOperation({ summary: 'Tarjetas vencidas hoy (por fecha)' })
  dueToday(@CurrentUser() u: JwtPayload, @Query('limit') limit?: string) {
    return this.due.execute(u.sub, Number(limit) || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Estado SM-2 de una tarjeta' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }

  @Post(':id/review')
  @ApiOperation({
    summary: 'Calificar el recuerdo (0 a 5) y reprogramar con SM-2',
  })
  reviewOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewFlashcardBody,
  ) {
    return this.review.execute(u.sub, id, body.quality);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar la tarjeta del mazo' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(u.sub, id);
  }
}
