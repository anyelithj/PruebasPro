import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Email } from '../../../users/domain/value-objects/email.vo';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../../domain/interfaces/password-reset-token.repository.interface';
import type { IPasswordResetTokenRepository } from '../../domain/interfaces/password-reset-token.repository.interface';
import { MAIL_SERVICE } from '../../domain/interfaces/mail.service.interface';
import type { IMailService } from '../../domain/interfaces/mail.service.interface';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { linkEmail } from '../mail/link-email'; // [Plantilla compartida]: mismo correo que la verificación de email | [Principio]: DRY
// [Use Case RequestPasswordReset]: emite token single-use + envía el enlace por correo | [Patrón]: Command + Port/Adapter | [Principio]: SRP + DIP
// [Seguridad]: respuesta siempre 200/genérica para no filtrar existencia de emails

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const TOKEN_TTL_MIN = TOKEN_TTL_MS / 60_000; // Minutos para el texto del correo | separador numérico `_` (ES2021)

@Injectable()
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: IPasswordResetTokenRepository,
    // [DI por token]: el caso de uso depende del Port, no de nodemailer | [Principio]: DIP
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const email = Email.create(dto.email);
    const user = await this.users.findByEmail(email.value);

    // [Genérico]: si no existe, no se filtra; salir 200 igualmente
    if (!user || !user.isActive) {
      this.logger.debug(
        `Password reset requested for unknown/inactive email: ${email.value}`,
      );
      return { success: true };
    }

    // [Invalida activos previos]: un solo token vigente por usuario
    await this.tokens.invalidateAllForUser(user.id);

    // [Token aleatorio]: 32 bytes hex (256-bit entropy); en BD solo se guarda su hash SHA-256
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.tokens.create({ userId: user.id, tokenHash, expiresAt });

    const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:7000';
    const link = `${appUrl}/reset-password?token=${token}`;

    // [Envío email]: vía Port IMailService (SMTP real o log en desarrollo) | try/catch → un fallo SMTP no revela nada al cliente
    try {
      await this.mail.send(
        linkEmail({
          to: user.email,
          firstName: user.firstName,
          subject: 'Restablece tu contraseña',
          intro: `Para crear una nueva contraseña abre este enlace (válido ${TOKEN_TTL_MIN} minutos):`,
          button: 'Restablecer contraseña',
          link,
          footer:
            'Si no lo solicitaste, ignora este correo; tu contraseña no cambiará.',
        }),
      );
    } catch (err) {
      // [Resiliencia]: se registra el error (sin el token) y se mantiene la respuesta genérica
      this.logger.error(
        `Password reset email failed for ${user.email}: ${(err as Error).message}`,
      );
    }

    return { success: true };
  }
}
