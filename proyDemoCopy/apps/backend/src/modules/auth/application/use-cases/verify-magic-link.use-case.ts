import { createHash } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { MagicLinkToken } from '../../domain/entities/magic-link-token.entity';
import type { AuthResponseDto } from '../dtos/auth-response.dto';
import { LoginUseCase } from './login.use-case';
// [UseCase VerifyMagicLink · Sprints 1.5/7.18]: canjea el token del enlace por una sesión (mismo par JWT que el login) | [Patrón]: Use Case (Command) + Compare-and-Set (UPDATE … WHERE used_at IS NULL) | [Principio]: DRY (LoginUseCase.issue emite tokens, sesión y evento) + Fail Fast | [Paradigma]: POO + async/await
// [Seguridad]: mensaje único para token inexistente, usado o caducado · el correo queda verificado (abrir el enlace prueba que es suyo)

@Injectable()
export class VerifyMagicLinkUseCase {
  constructor(
    @InjectRepository(MagicLinkToken)
    private readonly tokens: Repository<MagicLinkToken>,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly login: LoginUseCase,
  ) {}

  async execute(
    token: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    const invalid = new UnauthorizedException(
      'El enlace no es válido o ya caducó',
    );
    if (!/^[0-9a-f]{64}$/.test(token)) throw invalid;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await this.tokens.findOneBy({
      tokenHash,
      usedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
    if (!row) throw invalid;
    // [Un solo uso atómico]: solo la primera petición cambia la fila
    const { affected } = await this.tokens.update(
      { id: row.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!affected) throw invalid;
    let user = await this.users.findById(row.userId);
    if (!user || !user.isActive) throw invalid;
    if (!user.isEmailVerified)
      user = await this.users.update(user.id, { isEmailVerified: true });
    return this.login.issue(user, context);
  }
}
