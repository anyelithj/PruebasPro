import { Inject, Injectable, Logger } from '@nestjs/common';
import { SESSION_REPOSITORY } from '../../domain/interfaces/session.repository.interface';
import type { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import { TOKEN_SERVICE } from '../../domain/interfaces/token.service.interface';
import type { ITokenService } from '../../domain/interfaces/token.service.interface';
// [Use Case Logout]: revoca el refresh token de la sesión actual | [Patrón]: Command + Use Case | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
  ) {}

  // [execute]: idempotente — siempre retorna ok aunque la sesión ya no exista | [Principio]: SRP
  async execute(refreshToken: string | undefined): Promise<{ success: true }> {
    // [Logout sin refresh]: solo limpia cookie en frontend, no toca DB
    if (!refreshToken) return { success: true };

    const hash = this.tokens.hashRefresh(refreshToken);
    const session = await this.sessionRepo.findActiveByHash(hash);

    if (session && !session.isRevoked) {
      await this.sessionRepo.revoke(session.id);
      this.logger.log(`Session revoked: ${session.id}`);
    }

    return { success: true };
  }
}
