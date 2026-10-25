import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Email } from '../../../users/domain/value-objects/email.vo';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY } from '../../domain/interfaces/email-verification-token.repository.interface';
import type { IEmailVerificationTokenRepository } from '../../domain/interfaces/email-verification-token.repository.interface';
import { MAIL_SERVICE } from '../../domain/interfaces/mail.service.interface';
import type { IMailService } from '../../domain/interfaces/mail.service.interface';
import { RequestVerifyEmailDto } from '../dtos/request-verify-email.dto';
import { linkEmail } from '../mail/link-email'; // [Plantilla compartida]: mismo correo que restablecer contraseña | [Principio]: DRY
// [Use Case RequestVerifyEmail]: token de un solo uso + envío del enlace por correo | [Patrón]: Command + Port/Adapter | [Principio]: SRP + DIP
// [Seguridad]: respuesta siempre genérica para no filtrar qué correos existen

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const TOKEN_TTL_H = TOKEN_TTL_MS / 3_600_000; // Horas para el texto del correo | separador numérico `_` (ES2021)

@Injectable()
export class RequestVerifyEmailUseCase {
  private readonly logger = new Logger(RequestVerifyEmailUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly tokens: IEmailVerificationTokenRepository,
    // [DI por token]: depende del Port, no de nodemailer (SMTP real o log en desarrollo) | [Principio]: DIP
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
  ) {}

  async execute(dto: RequestVerifyEmailDto): Promise<{ success: true }> {
    const email = Email.create(dto.email);
    const user = await this.users.findByEmail(email.value);

    if (!user || !user.isActive) {
      this.logger.debug(
        `Verify email requested for unknown/inactive email: ${email.value}`,
      );
      return { success: true };
    }

    if (user.isEmailVerified) {
      this.logger.debug(`Email already verified for user: ${user.id}`);
      return { success: true };
    }

    await this.tokens.invalidateAllForUser(user.id);

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.tokens.create({ userId: user.id, tokenHash, expiresAt });

    const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:7000';
    const link = `${appUrl}/verify-email?token=${token}`;
    // [Envío email]: vía Port IMailService | try/catch → un fallo SMTP no cambia la respuesta ni expone el token
    try {
      await this.mail.send(
        linkEmail({
          to: user.email,
          firstName: user.firstName,
          subject: 'Verifica tu correo',
          intro: `Confirma tu dirección de correo abriendo este enlace (válido ${TOKEN_TTL_H} horas):`,
          button: 'Verificar correo',
          link,
          footer: 'Si no creaste una cuenta, ignora este correo.',
        }),
      );
    } catch (err) {
      // [Resiliencia]: se registra el error (sin el token) y se mantiene la respuesta genérica
      this.logger.error(
        `Verification email failed for ${user.email}: ${(err as Error).message}`,
      );
    }

    return { success: true };
  }
}
