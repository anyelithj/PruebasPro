import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
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
  @ApiOperation({ summary: 'Authenticate user and emit token pair' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.loginUC.execute(dto, this.extractContext(req));
  }

  // [POST /auth/oauth]: público — verifica id_token (Google/Microsoft) y emite par JWT propio
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
}
