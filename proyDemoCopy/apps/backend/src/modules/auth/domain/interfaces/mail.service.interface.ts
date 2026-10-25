// [Port servicio de correo]: contrato de envío de emails transaccionales | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

// [Token DI]: `Symbol` (ES2015) único → clave del provider que inyecta la implementación concreta (SmtpMailService)
export const MAIL_SERVICE = Symbol('MAIL_SERVICE');

// [Mensaje]: `interface` (TS) — forma mínima de un correo; texto plano + HTML para clientes sin HTML | [Principio]: KISS
export interface MailMessage {
  to: string; // Destinatario (ya normalizado por el Value Object Email)
  subject: string; // Asunto
  text: string; // Versión texto plano (accesible y anti-spam)
  html: string; // Versión HTML
}

// [Contrato]: un solo método → los casos de uso no conocen SMTP/SES/etc. | [Principio]: ISP + OCP (nuevo proveedor = nueva clase)
export interface IMailService {
  // `Promise<void>` (TS): envío asíncrono sin valor de retorno
  send(message: MailMessage): Promise<void>;
}
