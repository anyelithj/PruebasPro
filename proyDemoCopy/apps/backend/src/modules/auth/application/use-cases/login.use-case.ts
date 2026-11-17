import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
import type { User } from '../../../users/domain/entities/user.entity';
import { SESSION_REPOSITORY } from '../../domain/interfaces/session.repository.interface';
import type { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import { TOKEN_SERVICE } from '../../domain/interfaces/token.service.interface';
import type { ITokenService } from '../../domain/interfaces/token.service.interface';
import {
  USER_LOGGED_IN_EVENT,
  UserLoggedInEvent,
} from '../../domain/events/user-logged-in.event';
import { LoginDto } from '../dtos/login.dto';
import type { AuthResponseDto } from '../dtos/auth-response.dto';
import {
  IssueLoginOtpUseCase,
  type TwoFactorChallenge,
} from './issue-login-otp.use-case';
// [Use Case Login]: valida credenciales + emite tokens + crea sesión | [Patrón]: Command + Use Case | [Principio]: SRP + DIP | [Paradigma]: POO

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
    private readonly events: EventEmitter2,
    // [2FA · 2026-11-16]: si el usuario lo activó, el login devuelve un reto en vez de tokens
    private readonly otp: IssueLoginOtpUseCase,
  ) {}

  // [execute]: flujo principal del login | [Principio]: SRP
  async execute(
    dto: LoginDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto | TwoFactorChallenge> {
    const user = await this.users.findByEmail(dto.email);

    // [Mensaje genérico]: no revelar si email o password fueron incorrectos (anti enumeration)
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // [Compare bcrypt]: timing-safe internamente
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // [Segundo factor]: contraseña correcta pero falta el código del correo → sin tokens todavía | [Patrón]: Chain of Responsibility (paso 2 del login)
    if (user.twoFactorEnabled) return this.otp.execute(user);

    return this.issue(user, context);
  }

  // [issue · Sprint 7.18]: emite el par JWT + sesión revocable + evento de login para un usuario YA autenticado | `public` → el enlace mágico (VerifyMagicLinkUseCase) lo reutiliza | [Principio]: DRY
  async issue(
    user: User,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    // [Emisión tokens]
    const pair = await this.tokens.issuePair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // [Persistir sesión refresh]: para poder revocar
    const refreshHash = this.tokens.hashRefresh(pair.refreshToken);
    const decoded = await this.tokens.verifyRefresh(pair.refreshToken);
    const session = await this.sessionRepo.createSession({
      userId: user.id,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(decoded.exp * 1000),
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    // [Evento]: listeners para audit log / last-login | [Patrón]: Observer
    this.events.emit(
      USER_LOGGED_IN_EVENT,
      new UserLoggedInEvent(
        user.id,
        user.email,
        session.id,
        context?.ipAddress,
        context?.userAgent,
      ),
    );

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessExpiresIn: pair.accessExpiresIn,
      tokenType: pair.tokenType,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }
}
