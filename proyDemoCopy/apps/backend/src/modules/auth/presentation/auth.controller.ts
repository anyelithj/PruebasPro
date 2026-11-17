import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  IsBoolean,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import type { TwoFactorChallenge } from '../application/use-cases/issue-login-otp.use-case';
import {
  SetTwoFactorUseCase,
  VerifyLoginOtpUseCase,
} from '../application/use-cases/two-factor.use-cases';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { OAuthLoginUseCase } from '../application/use-cases/oauth-login.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from '../application/use-cases/register.use-case';
import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset.use-case';
import { RequestVerifyEmailUseCase } from '../application/use-cases/request-verify-email.use-case';
import { ResetPasswordUseCase } from '../application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from '../application/use-cases/verify-email.use-case';
import { LoginDto } from '../application/dtos/login.dto';
import { OAuthLoginDto } from '../application/dtos/oauth-login.dto';
import { RegisterDto } from '../application/dtos/register.dto';
import { RefreshTokenDto } from '../application/dtos/refresh.dto';
import { ForgotPasswordDto } from '../application/dtos/forgot-password.dto';
import { RequestVerifyEmailDto } from '../application/dtos/request-verify-email.dto';
import { ResetPasswordDto } from '../application/dtos/reset-password.dto';
import { AuthResponseDto } from '../application/dtos/auth-response.dto';
// [DTOs 2FA · 2026-11-16]: `class` + decoradores class-validator → el ValidationPipe global rechaza con 400 lo que no cumpla
export class VerifyTwoFactorDto {
  @IsUUID() challengeId!: string; // Id del reto devuelto por /auth/login
  @Matches(/^\d{6}$/) code!: string; // Exactamente 6 dígitos
}
export class SetTwoFactorDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MinLength(1) password!: string; // Contraseña actual (reautenticación)
}

// [Controller Auth]: capa Presentation, traduce HTTP → Use Case | [Patrón]: Controller (MVC) + Facade | [Principio]: SRP | [Paradigma]: POO

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // [Composición de UseCases]: facade que orquesta sin lógica propia | [Patrón]: Facade
  constructor(
    private readonly registerUC: RegisterUseCase,
    private readonly loginUC: LoginUseCase,
    private readonly refreshUC: RefreshTokenUseCase,
    private readonly logoutUC: LogoutUseCase,
    private readonly verifyEmailUC: VerifyEmailUseCase,
    private readonly requestVerifyEmailUC: RequestVerifyEmailUseCase,
    private readonly oauthUC: OAuthLoginUseCase,
    private readonly requestResetUC: RequestPasswordResetUseCase,
    private readonly resetPasswordUC: ResetPasswordUseCase,
    private readonly verifyOtpUC: VerifyLoginOtpUseCase,
    private readonly setTwoFactorUC: SetTwoFactorUseCase,
  ) {}

  // [Helper privado]: extrae contexto (IP/UA) del request | [Principio]: DRY
  private extractContext(req: Request): {
    ipAddress?: string;
    userAgent?: string;
  } {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ?? req.ip;
    return {
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // [POST /auth/register]: público | [Decorator @Public]: opt-out del JwtAuthGuard global
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.registerUC.execute(dto, this.extractContext(req));
  }

  // [POST /auth/login]: público
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Authenticate user and emit token pair (or a 2FA challenge if enabled)',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto | TwoFactorChallenge> {
    return this.loginUC.execute(dto, this.extractContext(req));
  }

  // [POST /auth/oauth]: público — verifica id_token de Google y emite par JWT propio
  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange OIDC id_token for application JWT pair' })
  async oauth(
    @Body() dto: OAuthLoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.oauthUC.execute(dto, this.extractContext(req));
  }

  // [POST /auth/refresh]: público (solo necesita refresh token válido)
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new token pair' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.refreshUC.execute(dto, this.extractContext(req));
  }

  // [POST /auth/logout]: idempotente, acepta sin token (limpia cookie)
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke current refresh session' })
  async logout(@Body() dto?: Partial<RefreshTokenDto>) {
    return this.logoutUC.execute(dto?.refreshToken);
  }

  // [POST /auth/request-verify-email]: público — siempre 200 (no filtra existencia de email)
  @Public()
  @Post('request-verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a verification email with token' })
  async requestVerifyEmail(
    @Body() dto: RequestVerifyEmailDto,
  ): Promise<{ success: true }> {
    return this.requestVerifyEmailUC.execute(dto);
  }

  // [POST /auth/verify-email]: público — valida token y marca email como verificado
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a user email via token' })
  async verifyEmail(@Body('token') token: string) {
    return this.verifyEmailUC.execute(token);
  }

  // [POST /auth/forgot-password]: público — siempre 200 (no filtra existencia de email)
  @Public()
  @Post('forgot-password')
  // `@Throttle` (@nestjs/throttler): máx. 5 solicitudes/min por IP → evita spam de correos y enumeración | [Seguridad]
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ success: true }> {
    return this.requestResetUC.execute(dto);
  }

  // [POST /auth/reset-password]: público — valida token + actualiza password
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a recovery token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: true }> {
    return this.resetPasswordUC.execute(dto);
  }

  // [POST /auth/2fa/verify · 2026-11-16]: público — canjea challengeId + código OTP por el par JWT | `@Throttle`: 5/min por IP (anti fuerza bruta, además de 5 intentos por reto)
  @Public()
  @Post('2fa/verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login with the emailed one-time code' })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.verifyOtpUC.execute(
      dto.challengeId,
      dto.code,
      this.extractContext(req),
    );
  }

  // [GET /auth/2fa]: autenticado (JwtAuthGuard global) — estado del 2FA del usuario actual
  @Get('2fa')
  @ApiOperation({ summary: 'Two-factor status of the current user' })
  async twoFactorStatus(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ enabled: boolean }> {
    return this.setTwoFactorUC.status(user.sub);
  }

  // [PATCH /auth/2fa]: autenticado — activa/desactiva el 2FA pidiendo la contraseña actual
  @Patch('2fa')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Enable or disable email two-factor authentication',
  })
  async setTwoFactor(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetTwoFactorDto,
  ): Promise<{ enabled: boolean }> {
    return this.setTwoFactorUC.execute(user.sub, dto.enabled, dto.password);
  }
}
