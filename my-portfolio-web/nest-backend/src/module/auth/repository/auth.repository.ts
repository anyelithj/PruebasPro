// [REPOSITORY][SRP] persistencia de sesiones/refresh — desacoplada del negocio de auth
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { PasswordResetTokenModel } from '../model/password-reset-token.model';
import { SessionModel } from '../model/session.model';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSession(data: {
    userId: string;
    refreshJti: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<SessionModel> {
    return this.prisma.session.create({ data });
  }

  findActiveByJti(refreshJti: string): Promise<SessionModel | null> {
    return this.prisma.session.findFirst({ where: { refreshJti, revoked: false } });
  }

  async revokeByJti(refreshJti: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { refreshJti }, data: { revoked: true } });
  }

  // [SEC] tras resetear la contraseña se cierran todas las sesiones abiertas del usuario.
  async revokeAllByUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { userId }, data: { revoked: true } });
  }

  async createPasswordReset(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.passwordResetToken.create({ data });
  }

  // Un token es válido si existe, no se usó y no venció.
  findValidPasswordReset(tokenHash: string): Promise<PasswordResetTokenModel | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async markPasswordResetUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  // Invalida los pendientes al emitir uno nuevo: solo el último enlace sirve.
  async invalidatePendingPasswordResets(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
