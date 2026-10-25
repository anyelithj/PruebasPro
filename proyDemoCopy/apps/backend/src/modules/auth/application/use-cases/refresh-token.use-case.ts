import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
import { SESSION_REPOSITORY } from '../../domain/interfaces/session.repository.interface';
import type { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import { TOKEN_SERVICE } from '../../domain/interfaces/token.service.interface';
import type { ITokenService } from '../../domain/interfaces/token.service.interface';
import { RefreshTokenDto } from '../dtos/refresh.dto';
import type { AuthResponseDto } from '../dtos/auth-response.dto';
// [Use Case Refresh]: rota refresh token (one-time use) y emite nuevo par | [Patrón]: Command + Use Case | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
  ) {}

  // [execute]: verifica + revoca actual + emite nuevo | [Principio]: SRP
  async execute(
    dto: RefreshTokenDto,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    // [Verificación firma + expiración]: lanza si inválido
    let payload;
    try {
      payload = await this.tokens.verifyRefresh(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // [Sesión activa]: refresh token debe estar registrado y no revocado
    const hash = this.tokens.hashRefresh(dto.refreshToken);
    const session = await this.sessionRepo.findActiveByHash(hash);
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session not active');
    }

    // [Usuario sigue activo]
    const user = await this.users.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    // [Rotación]: revocar el actual antes de emitir nuevo (one-time use)
    await this.sessionRepo.revoke(session.id);

    const pair = await this.tokens.issuePair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const newDecoded = await this.tokens.verifyRefresh(pair.refreshToken);
    await this.sessionRepo.createSession({
      userId: user.id,
      refreshTokenHash: this.tokens.hashRefresh(pair.refreshToken),
      expiresAt: new Date(newDecoded.exp * 1000),
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    this.logger.log(`Refreshed tokens for ${user.email}`);

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
