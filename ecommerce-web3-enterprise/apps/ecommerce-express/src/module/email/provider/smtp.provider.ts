// smtp.provider.ts => proveedor POR DEFECTO: Nodemailer + SMTP (gratuito; Mailpit en desarrollo).
// Adapter: traduce "send(to, content)" a la API de Nodemailer.
import nodemailer, { type Transporter } from "nodemailer";
import { appConfig } from "../../../config/app.config";
import type { EmailContent } from "../util/template.util";
import type { EmailProvider } from "./email.provider";

export class SmtpEmailProvider implements EmailProvider {
  public readonly name = "smtp";
  // Transporter perezoso (Lazy Singleton): la conexión SMTP se configura en el primer envío
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    // "??=" => crea el transporter solo si aún no existe
    this.transporter ??= nodemailer.createTransport({
      host: appConfig.SMTP_HOST,
      port: appConfig.SMTP_PORT,
      secure: appConfig.SMTP_PORT === 465, // 465 = SMTPS (TLS implícito); 587/1025 usan STARTTLS o texto plano en dev
      // Autenticación solo si hay credenciales (Mailpit/MailHog en desarrollo no las requieren)
      ...(appConfig.SMTP_USER ? { auth: { user: appConfig.SMTP_USER, pass: appConfig.SMTP_PASS } } : {}),
    });
    return this.transporter;
  }

  public async send(to: string, content: EmailContent): Promise<void> {
    await this.getTransporter().sendMail({
      from: appConfig.SMTP_FROM,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text, // Alternativa en texto plano (accesibilidad + entregabilidad)
      // Spread condicional: Nodemailer solo recibe "attachments" si el correo los trae (RF-11.2)
      ...(content.attachments?.length ? { attachments: content.attachments.map((file) => ({ filename: file.filename, content: file.content, contentType: file.contentType })) } : {}),
    });
  }
}
