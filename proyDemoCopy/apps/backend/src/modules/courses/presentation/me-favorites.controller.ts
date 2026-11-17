import { Controller, Get, Query } from '@nestjs/common'; // [NestJS]: controlador REST + parámetros de consulta
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'; // [Swagger]: contrato documentado
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { CourseEngagementUseCase } from '../application/use-cases/course-engagement.use-case';
import { FavoritesQueryDto } from '../application/dtos/course-engagement.dto';
import { PaginatedCoursesResponseDto } from '../application/dtos/course-response.dto';
// [Controller MeFavorites · 2026-11-13 · Caso F]: GET /me/favorites — «Mis favoritos» del usuario con sesión, paginado en el SERVIDOR
// [Seguridad]: sin @Public → JwtAuthGuard global exige sesión; el id sale del JWT (nunca del cliente) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio

@ApiTags('courses')
@ApiBearerAuth()
@Controller('me/favorites') // `@Controller` (NestJS): prefijo de ruta → /api/v1/me/favorites
export class MeFavoritesController {
  constructor(private readonly engagement: CourseEngagementUseCase) {} // [DI]: el mismo caso de uso que PUT/DELETE …/favorite (DRY)

  @Get()
  @ApiOperation({
    summary:
      '⭐ Mis favoritos o 👍/❤️ valorados (paginado, del más reciente al más antiguo)',
  })
  @ApiOkResponse({ type: PaginatedCoursesResponseDto })
  list(
    @CurrentUser() user: JwtPayload,
    @Query() q: FavoritesQueryDto,
  ): Promise<PaginatedCoursesResponseDto> {
    return this.engagement.listFavorites(user.sub, q.page, q.limit, q.kind); // `@Query()` + DTO: page/limit validados y con tope
  }
}
