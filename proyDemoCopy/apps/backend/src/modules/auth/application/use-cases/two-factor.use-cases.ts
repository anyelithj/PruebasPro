import { timingSafeEqual } from 'node:crypto';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { LoginOtp } from '../../domain/entities/login-otp.entity';
import type { AuthResponseDto } from '../dtos/auth-response.dto';
import { hashCode, MAX_OTP_ATTEMPTS } from './issue-login-otp.use-case';
import { LoginUseCase } from './login.use-case';
// [Casos de uso 2FA · 2026-11-16]: canje del código OTP y activación del segundo factor | [Patrón]: Use Case (Command/Query) + Compare-and-Set | [Principio]: SRP + DRY (LoginUseCase.issue emite la sesión) | [Paradigma]: POO + async/await

// [VerifyLoginOtpUseCase]: canjea challengeId + código por el par JWT
@Injectable()
export class VerifyLoginOtpUseCase {
  constructor(
    @InjectRepository(LoginOtp) private readonly otps: Repository<LoginOtp>,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly login: LoginUseCase, // [DRY]: misma emisión de tokens + sesión + evento que el login normal
  ) {}

  async execute(
    challengeId: string,
    code: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    // [Mensaje único]: no distingue reto inexistente, usado, caducado o código erróneo
    const invalid = new UnauthorizedException(
      'El código no es válido o ya caducó',
    );
    const row = await this.otps.findOneBy({
      id: challengeId,
      usedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
    if (!row || row.attempts >= MAX_OTP_ATTEMPTS) throw invalid;

    // `timingSafeEqual` (Node crypto): comparación en tiempo constante → sin fuga por temporización
    const ok = timingSafeEqual(
      Buffer.from(row.codeHash, 'hex'),
      Buffer.from(hashCode(row.userId, code), 'hex'),
    );
    if (!ok) {
      // `increment` (TypeORM): UPDATE atómico attempts = attempts + 1
      await this.otps.increment({ id: row.id }, 'attempts', 1);
      throw invalid;
    }
    // [Un solo uso atómico]: solo la primera petición cambia la fila (dos envíos simultáneos no abren dos sesiones)
    const { affected } = await this.otps.update(
      { id: row.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!affected) throw invalid;

    const user = await this.users.findById(row.userId);
    if (!user || !user.isActive) throw invalid;
    return this.login.issue(user, context);
  }
}

// [SetTwoFactorUseCase]: consulta y activa/desactiva el 2FA del usuario autenticado (pide la contraseña actual)
@Injectable()
export class SetTwoFactorUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  // [status]: lectura para la tarjeta «Verificación en dos pasos» del perfil | [Patrón]: Query (CQRS ligero)
  async status(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return { enabled: user.twoFactorEnabled };
  }

  // [execute]: Command — cambia el flag tras reautenticar
  async execute(
    userId: string,
    enabled: boolean,
    password: string,
  ): Promise<{ enabled: boolean }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    // [Reautenticación]: una sesión robada no puede apagar el 2FA sin la contraseña | `bcrypt.compare`: tiempo constante
    if (!(await bcrypt.compare(password, user.passwordHash)))
      throw new UnauthorizedException('La contraseña no es correcta');
    const updated = await this.users.update(userId, {
      twoFactorEnabled: enabled,
    });
    return { enabled: updated.twoFactorEnabled };
  }
}
