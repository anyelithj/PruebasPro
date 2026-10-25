// [MVC-C][SRP] solo delega al AuthService — rutas públicas (@Public)
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { forgotPasswordSchema, ForgotPasswordDto } from '../dto/forgot-password.dto';
import { loginSchema, LoginDto } from '../dto/login.dto';
import { refreshTokenSchema, RefreshTokenDto } from '../dto/refresh-token.dto';
import { registerSchema, RegisterDto } from '../dto/register.dto';
import { resetPasswordSchema, ResetPasswordDto } from '../dto/reset-password.dto';
import { AuthService } from '../service/auth.service';
import { AUTH_ROUTES } from '../route/auth.routes';

@Controller(AUTH_ROUTES.ROOT)
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(AUTH_ROUTES.REGISTER)
  @HttpCode(HttpStatus.CREATED)
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post(AUTH_ROUTES.LOGIN)
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post(AUTH_ROUTES.REFRESH)
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(refreshTokenSchema)) dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post(AUTH_ROUTES.LOGOUT)
  @HttpCode(HttpStatus.OK)
  async logout(@Body(new ZodValidationPipe(refreshTokenSchema)) dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { success: true, data: null, message: 'Logged out' };
  }

  @Post(AUTH_ROUTES.FORGOT_PASSWORD)
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    // Mensaje neutro a propósito: no revela si el email está registrado.
    return {
      success: true,
      data: null,
      message: 'If the email exists, a reset link was sent',
    };
  }

  @Post(AUTH_ROUTES.RESET_PASSWORD)
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { success: true, data: null, message: 'Password updated' };
  }
}
