import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { bearer } from '../../ai/assistant.controller';
import { ClearMyAttemptsUseCase } from '../application/use-cases/clear-my-attempts.use-case';
import { ListMyAttemptsUseCase } from '../application/use-cases/list-my-attempts.use-case';
import { GetAttemptUseCase } from '../application/use-cases/get-attempt.use-case';
import { SubmitAttemptUseCase } from '../application/use-cases/submit-attempt.use-case';
import { actorOf } from './practice-activities.controller';
// [Controller PracticeAttempts · Sprint 8.12 · RF-112/RF-113]: responder un ítem y recibir la corrección al instante, listar y ver intentos, borrar el historial | [Patrón]: Thin Controller | [Principio]: SRP + privacidad | [Paradigma]: POO + Decoradores

export class AttemptBody {
  @IsUUID() itemId!: string;
  // Respuesta según el tipo: huecos, fichas en orden, índices marcados o texto libre
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  answer!: string[];
}

@ApiTags('practice')
@ApiBearerAuth()
@Controller('practice/attempts')
export class PracticeAttemptsController {
  constructor(
    private readonly submit: SubmitAttemptUseCase,
    private readonly listMine: ListMyAttemptsUseCase,
    private readonly get: GetAttemptUseCase,
    private readonly clear: ClearMyAttemptsUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Enviar la respuesta de un ítem y recibir la corrección al instante',
  })
  submitOne(
    @CurrentUser() u: JwtPayload,
    @Body() body: AttemptBody,
    @Headers('authorization') auth: string,
  ) {
    return this.submit.execute(
      actorOf(u),
      body.itemId,
      body.answer,
      bearer(auth),
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis intentos (filtro opcional: activityId)' })
  mine(@CurrentUser() u: JwtPayload, @Query('activityId') activityId?: string) {
    return this.listMine.execute(u.sub, activityId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Intento con errores, correcciones, respuesta correcta y consejos',
  })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Borrar mi historial de intentos' })
  clearMine(@CurrentUser() u: JwtPayload) {
    return this.clear.execute(u.sub);
  }
}
