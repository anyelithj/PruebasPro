import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'crypto';
import { Email } from '../../../users/domain/value-objects/email.vo';
import { Role } from '../../../users/domain/value-objects/role.vo';
import { CreateUserUseCase } from '../../../users/application/use-cases/create-user.use-case';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
import { SESSION_REPOSITORY } from '../../domain/interfaces/session.repository.interface';
import type { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import { TOKEN_SERVICE } from '../../domain/interfaces/token.service.interface';
import type { ITokenService } from '../../domain/interfaces/token.service.interface';
import { OAUTH_VERIFIER_REGISTRY } from '../../domain/interfaces/oauth-verifier.interface';
import type { IOAuthVerifierRegistry } from '../../domain/interfaces/oauth-verifier.interface';
import {
  USER_LOGGED_IN_EVENT,
  UserLoggedInEvent,
} from '../../domain/events/user-logged-in.event';
import { OAuthLoginDto } from '../dtos/oauth-login.dto';
import type { AuthResponseDto } from '../dtos/auth-response.dto';
// [Use Case OAuthLogin]: verifica id_token, find-or-create user, emite par JWT propio | [Patrón]: Command + Use Case | [Principio]: SRP + DIP

@Injectable()
export class OAuthLoginUseCase {
  private readonly logger = new Logger(OAuthLoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    // [Alta del User]: la hace el módulo Users (dueño de la entidad) | [Principio]: DRY
    private readonly createUser: CreateUserUseCase,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
    @Inject(OAUTH_VERIFIER_REGISTRY)
    private readonly verifiers: IOAuthVerifierRegistry,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    dto: OAuthLoginDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    // [Verifica id_token]: Strategy via registry → Google/Microsoft adapter
    const verifier = this.verifiers.get(dto.provider);
    const profile = await verifier.verify(dto.idToken);

    if (!profile.emailVerified) {
      throw new ForbiddenException(
        'El email del proveedor OAuth no está verificado',
      );
    }

    // [Normaliza email]: reutiliza VO existente
    const email = Email.create(profile.email);
    let user = await this.users.findByEmail(email.value);

    // [Provisioning lazy]: si no existe, crea cuenta usando datos OIDC
    if (!user) {
      // [Placeholder passwordHash]: random hash; usuario OAuth no puede login con password
      // (passwordHash es NOT NULL en entity actual — evita migración del schema)
      user = await this.createUser.execute({
        email: email.value,
        password: randomBytes(32).toString('hex'),
        firstName: profile.firstName?.trim() || email.value.split('@')[0],
        lastName: profile.lastName?.trim() || '',
        role: Role.USER,
      });
      // [Marca email verificado]: provider OAuth ya validó ownership
      if (!user.isEmailVerified) {
        user = await this.users.update(user.id, { isEmailVerified: true });
      }
    } else if (!user.isActive) {
      throw new ForbiddenException('La cuenta está deshabilitada');
    } else if (!user.isEmailVerified) {
      // [Auto-verifica]: si usuario existente nunca verificó, OAuth lo valida
      user = await this.users.update(user.id, { isEmailVerified: true });
    }

    // [Emisión tokens propios]: reutiliza ITokenService existente | [SSOT]: mismo JWT que login password
    const pair = await this.tokens.issuePair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // [Persistir sesión refresh]: para poder revocar (logout)
    const refreshHash = this.tokens.hashRefresh(pair.refreshToken);
    const decoded = await this.tokens.verifyRefresh(pair.refreshToken);
    const session = await this.sessionRepo.createSession({
      userId: user.id,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(decoded.exp * 1000),
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

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

    this.logger.log(`OAuth login (${profile.provider}): ${user.email}`);

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
