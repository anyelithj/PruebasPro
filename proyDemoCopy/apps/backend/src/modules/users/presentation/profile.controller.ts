import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OptionalPhone } from '../application/dtos/optional-phone.decorator'; // [2026-10-24]: decorador compuesto del teléfono
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../../shared/decorators/current-user.decorator';
import { GetProfileUseCase } from '../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../application/use-cases/update-profile.use-case';
import { GetUserHistoryUseCase } from '../application/use-cases/get-user-history.use-case';
import { DeleteAccountUseCase } from '../application/use-cases/delete-account.use-case';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiProperty({ required: false, example: '11-1' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;

  // [2026-10-23]: preferencias del perfil (antes localStorage) | `IsOptional` (class-validator): PATCH parcial
  @ApiProperty({ required: false, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  // [Teléfono · 2026-10-24]: opcional · regla única en `@OptionalPhone` (users/domain/value-objects/phone.vo.ts) | vacío = borrar el teléfono | [Principio]: DRY
  @OptionalPhone()
  phone?: string;

  @ApiProperty({ required: false, example: 'America/Bogota' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiProperty({ required: false, enum: ['es', 'en', 'pt'] })
  @IsOptional()
  @IsIn(['es', 'en', 'pt'])
  preferredLanguage?: string;
}

// [DTO ChangePassword · 2026-10-23]: misma política de contraseña que registro/reset | [Principio]: DRY (regla única de fortaleza)
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'StrongP@ss123' })
  @IsString()
  @MinLength(8, { message: 'Password too short (min 8)' })
  @MaxLength(128, { message: 'Password too long (max 128)' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain uppercase, lowercase, and digit',
  })
  newPassword!: string;
}

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly getProfileUC: GetProfileUseCase,
    private readonly updateProfileUC: UpdateProfileUseCase,
    private readonly getHistoryUC: GetUserHistoryUseCase,
    private readonly deleteAccountUC: DeleteAccountUseCase,
    private readonly changePasswordUC: ChangePasswordUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.getProfileUC.execute(user.sub);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Get own profile with history data' })
  async getMyHistory(@CurrentUser() user: JwtPayload) {
    return this.getHistoryUC.execute(user.sub);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update own profile (names, section, bio, timezone, language)',
  })
  async updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.updateProfileUC.execute(user.sub, dto);
  }

  // [POST /profile/me/password]: cambio de contraseña con la actual | [Patrón]: Command
  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  async changeMyPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.changePasswordUC.execute(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate own account (soft delete)' })
  async deleteMyAccount(@CurrentUser() user: JwtPayload) {
    await this.deleteAccountUC.execute(user.sub);
  }
}
