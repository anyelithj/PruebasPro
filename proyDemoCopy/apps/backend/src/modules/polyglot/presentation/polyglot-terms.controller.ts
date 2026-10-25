import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { bearer } from '../../ai/assistant.controller';
import { actorOf } from '../../music/presentation/songs.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import { ReviewTermBody, TermsBody } from '../application/dtos/polyglot.dto';
import { RemoveTermUseCase } from '../application/use-cases/remove-term.use-case';
import { ReviewTermUseCase } from '../application/use-cases/review-term.use-case';
import {
  GetTermUseCase,
  ListTermsUseCase,
  UpsertTermsUseCase,
} from '../application/use-cases/upsert-terms.use-case';
// [Controller PolyglotTerms · Sprint 10.5 · RF-130/RF-132]: términos de un concepto por idioma — guardar con IPA, listar y ver (todos), revisar y quitar (TEACHER o ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('polyglot')
@ApiBearerAuth()
@Controller('polyglot')
export class PolyglotTermsController {
  constructor(
    private readonly upsert: UpsertTermsUseCase,
    private readonly list: ListTermsUseCase,
    private readonly get: GetTermUseCase,
    private readonly review: ReviewTermUseCase,
    private readonly remove: RemoveTermUseCase,
  ) {}

  @Post('concepts/:id/terms')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Guardar los términos del concepto en varios idiomas y obtener su IPA',
  })
  upsertMany(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TermsBody,
    @Headers('authorization') auth: string,
  ) {
    return this.upsert.execute(actorOf(u), id, body.terms, bearer(auth));
  }

  @Get('concepts/:id/terms')
  @ApiOperation({ summary: 'Términos del concepto por idioma' })
  listMany(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.list.execute(actorOf(u), id);
  }

  @Get('terms/:id')
  @ApiOperation({ summary: 'Un término con su IPA y su estado de revisión' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Patch('terms/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Corregir el término o el IPA y marcarlo como revisado',
  })
  reviewOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewTermBody,
  ) {
    return this.review.execute(actorOf(u), id, body);
  }

  @Delete('terms/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Quitar el término' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(actorOf(u), id);
  }
}
