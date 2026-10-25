import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type {
  IMailService,
  MailMessage,
} from '../../domain/interfaces/mail.service.interface';
// [Adapter SMTP]: implementa IMailService con nodemailer | [Patrón]: Adapter (Hexagonal) + Null Object (sin SMTP → log) | [Principio]: DIP + SRP | [Paradigma]: POO
// [Configuración]: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (ver .env.example)

// `@Injectable()` (NestJS): registra la clase en el contenedor de DI
@Injectable()
export class SmtpMailService implements IMailService {
  // `private readonly` (TS): campo inmutable y encapsulado | Logger con el nombre de la clase (NestJS)
  private readonly logger = new Logger(SmtpMailService.name);
  // [Transporter]: `null` si no hay SMTP_HOST → modo desarrollo (solo log) | `Transporter | null` (TS): unión de tipos
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    const env = process.env; // Alias corto de las variables de entorno (Node.js)
    const port = Number(env.SMTP_PORT ?? 587); // `??` (ES2020): valor por defecto si no está definido
    this.from = env.SMTP_FROM ?? 'NeuroLearning <no-reply@neurolearning.local>';
    // [Operador ternario]: crea el transporte solo si hay host configurado
    this.transporter = env.SMTP_HOST
      ? createTransport({
          host: env.SMTP_HOST,
          port,
          secure: port === 465, // 465 = TLS implícito; 587 = STARTTLS
          // [Ternario]: solo añade credenciales si existe el usuario (servidores SMTP abiertos no las requieren)
          auth: env.SMTP_USER
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
        })
      : null;
    if (!this.transporter)
      this.logger.warn(
        'SMTP_HOST no definido → los correos solo se registran en el log (modo desarrollo)',
      );
  }

  // `async` (ES2017): devuelve Promise; los errores SMTP se propagan al caso de uso
  async send(message: MailMessage): Promise<void> {
    // [Null Object]: sin SMTP se registra el correo completo para poder probar el flujo en local
    if (!this.transporter) {
      this.logger.log(
        `[MAIL:DEV] to=${message.to} subject="${message.subject}"\n${message.text}`,
      );
      return;
    }
    // `await` (ES2017): espera la entrega al servidor SMTP | spread (ES2018) copia to/subject/text/html
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
