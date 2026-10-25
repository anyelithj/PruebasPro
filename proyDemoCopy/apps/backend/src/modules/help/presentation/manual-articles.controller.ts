import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { bearer } from '../../ai/assistant.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  GetManualArticleUseCase,
  GetManualAssetUseCase,
} from '../application/use-cases/get-manual-article.use-case';
import { ListManualUseCase } from '../application/use-cases/list-manual.use-case';
import { ReindexManualUseCase } from '../application/use-cases/reindex-manual.use-case';
import {
  HELP_LOCALES,
  HELP_ROLES,
  type HelpLocale,
  type HelpRole,
} from '../domain/entities/faq.entity';
// [Controller ManualArticles · Sprint 7.10 · RF-95/97]: manual por rol (con sesión) y reindexado desde docs/manual-usuario (ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (el rol sale del JWT) | [Paradigma]: POO + Decoradores

export class ManualQuery {
  @IsOptional() @IsIn(HELP_LOCALES) locale?: HelpLocale;
  @IsOptional() @IsIn(HELP_ROLES) role?: HelpRole;
}

@ApiTags('help')
@ApiBearerAuth()
@Controller('help/manual')
export class ManualArticlesController {
  constructor(
    private readonly reindex: ReindexManualUseCase,
    private readonly list: ListManualUseCase,
    private readonly get: GetManualArticleUseCase,
    private readonly asset: GetManualAssetUseCase,
  ) {}

  @Post('reindex')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Publicar docs/manual-usuario, sembrar la FAQ inicial y reindexar el Agente Guía (ADMIN)',
  })
  reindexAll(@Headers('authorization') auth: string) {
    return this.reindex.execute(bearer(auth));
  }

  @Get()
  @ApiOperation({
    summary: 'Tabla de contenido del manual visible para mi rol',
  })
  findAll(@CurrentUser() user: JwtPayload, @Query() q: ManualQuery) {
    return this.list.execute(user.role, q.locale ?? 'es', q.role);
  }

  // [Antes de :slug]: Express resuelve las rutas en orden → «assets» no se toma como slug de un artículo
  @Public()
  @Get('assets/:file')
  @ApiOperation({ summary: 'Captura de pantalla del manual (PNG/WebP)' })
  async file(@Param('file') file: string, @Res() res: Response): Promise<void> {
    const { bytes, contentType } = await this.asset.execute(file);
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Un día: cambian solo al reindexar el manual
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(bytes);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Artículo del manual en Markdown' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Query() q: ManualQuery,
  ) {
    return this.get.execute(slug, q.locale ?? 'es', user.role);
  }
}
