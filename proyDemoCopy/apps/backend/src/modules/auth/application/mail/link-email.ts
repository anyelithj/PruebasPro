import type { MailMessage } from '../../domain/interfaces/mail.service.interface';
// [Plantilla «correo con enlace»]: un solo formato para restablecer contraseña y verificar correo | [Patrón]: Template Method (funcional) + Factory | [Principio]: DRY + SRP | [Paradigma]: Funcional (función pura)

// [Datos variables del correo]: `interface` (TS) — lo que cambia entre un correo y otro; el resto es la plantilla
export interface LinkEmailInput {
  to: string; // Destinatario (ya normalizado por el Value Object Email)
  firstName: string; // Saludo; se escapa en el HTML
  subject: string; // Asunto
  intro: string; // Frase antes del enlace (texto plano, sin HTML)
  button: string; // Texto del botón
  link: string; // URL con el token de un solo uso
  footer: string; // Aviso final (qué hacer si no lo solicitó)
}

// `export const` (ES2015) + arrow function: devuelve el MailMessage listo para IMailService.send()
export const linkEmail = ({
  to,
  firstName,
  subject,
  intro,
  button,
  link,
  footer,
}: LinkEmailInput): MailMessage => ({
  to,
  subject,
  // [Texto plano]: clientes sin HTML y filtros anti-spam | template literal (ES2015) con saltos de línea `\n`
  text: `Hola ${firstName},\n\n${intro}\n${link}\n\n${footer}`,
  // [HTML]: botón con estilos en línea (los clientes de correo ignoran <style>) | nombre escapado → sin inyección HTML
  html:
    `<p>Hola ${escapeHtml(firstName)},</p><p>${escapeHtml(intro)}</p>` +
    `<p><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#7C3AED;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(button)}</a></p>` +
    `<p style="font-size:12px;color:#666">${escapeHtml(footer)}</p>`,
});

// [escapeHtml]: reemplaza & < > " ' por entidades HTML | `replace` + regex global (ES5) + Lookup Table | `!` (TS): el regex garantiza la clave
export const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
