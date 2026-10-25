import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { MagicLinkToken } from '../../domain/entities/magic-link-token.entity';
import {
  MAIL_SERVICE,
  type IMailService,
} from '../../domain/interfaces/mail.service.interface';
import { linkEmail } from '../mail/link-email';
// [UseCase RequestMagicLink · Sprints 1.5/7.18]: envía por correo un enlace de acceso sin contraseña (15 min, un solo uso) | [Patrón]: Use Case (Command) + Token de un solo uso | [Principio]: SRP + DIP (correo por IMailService = bandeja de salida) + DRY (misma plantilla linkEmail) | [Paradigma]: POO + async/await
// [Seguridad]: respuesta SIEMPRE genérica (no revela si el correo existe) · solo se guarda el hash · el enlace apunta al BFF de Next.js, que pone la cookie httpOnly

const TOKEN_TTL_MIN = 15;

@Injectable()
export class RequestMagicLinkUseCase {
  private readonly logger = new Logger(RequestMagicLinkUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @InjectRepository(MagicLinkToken)
    private readonly tokens: Repository<MagicLinkToken>,
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
  ) {}

  async execute(email: string): Promise<{ sent: true }> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user || !user.isActive) return { sent: true }; // Anti-enumeración
    const token = randomBytes(32).toString('hex'); // 256 bits de entropía
    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MIN * 60_000),
        usedAt: null,
      }),
    );
    const appUrl = (
      process.env.FRONTEND_URL ?? 'http://localhost:9000'
    ).replace(/\/$/, '');
    try {
      await this.mail.send(
        linkEmail({
          to: user.email,
          firstName: user.firstName ?? '',
          subject: 'Tu enlace de acceso',
          intro: `Abre este enlace para entrar sin contraseña (válido ${TOKEN_TTL_MIN} minutos, un solo uso):`,
          button: 'Entrar a Aula de Idiomas',
          link: `${appUrl}/api/auth/magic-link?token=${token}`,
          footer:
            'Si no lo pediste, ignora este correo: nadie podrá entrar sin abrir el enlace.',
        }),
      );
    } catch (err) {
      this.logger.error(
        `Magic link email failed for ${user.email}: ${(err as Error).message}`,
      ); // Sin el token en el log
    }
    return { sent: true };
  }
}
