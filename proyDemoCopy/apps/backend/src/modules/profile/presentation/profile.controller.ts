import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { UpdateProfileDto } from '../application/dtos/update-profile.dto';
import { ProfileResponseDto } from '../application/dtos/profile-response.dto';
import { GetFullProfileUseCase } from '../application/use-cases/get-full-profile.use-case';
import { GetPublicProfileUseCase } from '../application/use-cases/get-public-profile.use-case';
import { UpdateProfileUseCase } from '../application/use-cases/update-profile.use-case';
// [Controller Profile]: REST API del Bounded Context Profile | [Patrón]: Controller (MVC) | [Principio]: SRP

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly getFullProfile: GetFullProfileUseCase,
    private readonly getPublicProfile: GetPublicProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
  ) {}

  // [GET /profile/me]: perfil del usuario autenticado | [Principio]: SRP
  @Get('me')
  @ApiOperation({ summary: 'Obtener mi perfil completo' })
  async me(
    @CurrentUser() user: JwtPayload,
  ): Promise<ProfileResponseDto | { userId: string; pending: true }> {
    const dto = await this.getFullProfile.execute(user.sub);
    // [Sin perfil aún]: contrato deliberado — el frontend renderiza form vacío.
    if (!dto) return { userId: user.sub, pending: true };
    return dto;
  }

  // [PUT /profile/me]: upsert del perfil (idempotente) | [Patrón]: Command
  @Put('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Crear o actualizar mi perfil' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.updateProfile.execute(user.sub, dto);
  }

  // [GET /profile/:userId/public]: subset público de cualquier usuario | [Principio]: Least Privilege
  @Get(':userId/public')
  @ApiOperation({ summary: 'Obtener perfil público (subset) de un usuario' })
  async publicView(@Param('userId', ParseUUIDPipe) targetUserId: string) {
    const view = await this.getPublicProfile.execute(targetUserId);
    if (!view)
      throw new NotFoundException(
        `Perfil público no disponible para ${targetUserId}`,
      );
    return view;
  }
}
