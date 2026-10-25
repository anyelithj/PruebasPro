// [SRP][OOP] orquesta login/register/refresh/logout/reset — combina token service + repos
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { ConflictException, UnauthorizedException } from 'src/common/exceptions/validation.exception';
import { hashPassword, verifyPassword } from 'src/common/utils/hash.util';
import { toUserResponse, UserResponseDto } from 'src/module/user/dto/user-response.dto';
import { UserModel } from 'src/module/user/model/user.model';
import { UserRepository } from 'src/module/user/repository/user.repository';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { AuthRepository } from '../repository/auth.repository';
import { TokenService } from './token.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'bearer';
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: AuthRepository,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash: await hashPassword(dto.password),
    });
    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await verifyPassword(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('User inactive');
    }
    return this.issue(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload;
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const jti = payload.jti ?? '';
    const session = await this.sessions.findActiveByJti(jti);
    if (!session) {
      throw new UnauthorizedException('Session revoked or expired');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // [SEC] rotación: revoca el jti usado antes de emitir uno nuevo.
    await this.sessions.revokeByJti(jti);
    return this.issue(user);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.tokens.verifyRefresh(refreshToken);
      await this.sessions.revokeByJti(payload.jti ?? '');
    } catch {
      // token inválido → nada que revocar; logout idempotente.
    }
  }

  // [SEC] respuesta idéntica exista o no el email: no filtra qué cuentas están registradas.
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !user.isActive) return;

    await this.sessions.invalidatePendingPasswordResets(user.id);

    const token = randomBytes(32).toString('hex');
    const ttlMinutes = this.config.get<number>('app.passwordResetTtlMinutes') ?? 30;
    await this.sessions.createPasswordReset({
      userId: user.id,
      tokenHash: AuthService.hashToken(token),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    });

    // Sin servicio de correo todavía: el enlace se entrega por los logs del backend.
    const base = this.config.get<string>('app.frontendUrl');
    this.logger.warn(
      `[password-reset] ${user.email} → ${base}/reset-password?token=${token} (vence en ${ttlMinutes} min)`,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.sessions.findValidPasswordReset(AuthService.hashToken(dto.token));
    if (!record) {
      throw new UnauthorizedException('Reset token invalid or expired');
    }

    await this.users.update(record.userId, { passwordHash: await hashPassword(dto.password) });
    await this.sessions.markPasswordResetUsed(record.id);
    // Contraseña cambiada → toda sesión previa deja de valer.
    await this.sessions.revokeAllByUser(record.userId);
  }

  // Se persiste el hash, nunca el token en claro: si se filtra la tabla, los enlaces siguen sin servir.
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issue(user: UserModel): Promise<AuthResult> {
    const pair = await this.tokens.createTokenPair(user);
    await this.sessions.createSession({
      userId: user.id,
      refreshJti: pair.refreshJti,
      expiresAt: pair.refreshExpiresAt,
    });
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      tokenType: 'bearer',
      user: toUserResponse(user),
    };
  }
}
