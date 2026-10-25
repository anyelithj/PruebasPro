import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateUserUseCase } from '../../../users/application/use-cases/create-user.use-case';
import { Role } from '../../../users/domain/value-objects/role.vo';
import { TOKEN_SERVICE } from '../../domain/interfaces/token.service.interface';
import type { ITokenService } from '../../domain/interfaces/token.service.interface';
import { SESSION_REPOSITORY } from '../../domain/interfaces/session.repository.interface';
import type { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import {
  USER_REGISTERED_EVENT,
  UserRegisteredEvent,
} from '../../domain/events/user-registered.event';
import { RegisterDto } from '../dtos/register.dto';
import type { AuthResponseDto } from '../dtos/auth-response.dto';
// [Use Case Register]: alta pública = CreateUserUseCase (Users) + sesión + emisión tokens | [Patrón]: Command + Use Case | [Principio]: SRP + DIP | [Paradigma]: POO

@Injectable()
export class RegisterUseCase {
  // [Logger ámbito]: namespace propio para grep
  private readonly logger = new Logger(RegisterUseCase.name);

  // [Inyección dependencias]: todas via interface (Port) | [Patrón]: DI + Repository
  constructor(
    // [Alta del User]: la hace el módulo Users (dueño de la entidad) | [Principio]: DRY + SRP
    private readonly createUser: CreateUserUseCase,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
    // [EventEmitter2]: bus in-memory para Domain Events | [Patrón]: Observer
    private readonly events: EventEmitter2,
  ) {}

  // [execute]: punto único de entrada del Use Case | [Principio]: SRP
  async execute(
    dto: RegisterDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    // [Alta del User]: email único + hash bcrypt + persistencia; rol siempre USER (RBAC seguro)
    const user = await this.createUser.execute({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: Role.USER,
    });

    // [Emisión tokens]: par access + refresh
    const pair = await this.tokens.issuePair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // [Persistir sesión]: refresh token hasheado en DB para poder revocar
    const refreshHash = this.tokens.hashRefresh(pair.refreshToken);
    const decoded = await this.tokens.verifyRefresh(pair.refreshToken);
    await this.sessionRepo.createSession({
      userId: user.id,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(decoded.exp * 1000),
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    // [Evento dominio]: listeners (analytics, email welcome) reaccionan async | [Patrón]: Observer
    this.events.emit(
      USER_REGISTERED_EVENT,
      new UserRegisteredEvent(user.id, user.email, user.role),
    );

    this.logger.log(`User registered: ${user.email} (${user.id})`);

    // [Respuesta]: tokens + perfil mínimo (sin passwordHash)
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
