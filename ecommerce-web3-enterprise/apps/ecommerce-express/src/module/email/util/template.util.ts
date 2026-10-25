// template.util.ts => plantillas de email transaccional como FUNCIONES PURAS (dato + idioma -> { subject, html, text }).
// Paradigma funcional + patrón Template Method: "layout()" fija la estructura común (cabecera, pie, estilos inline)
// y cada plantilla solo aporta su contenido (DRY). Los textos salen del diccionario es/en (messages.constants) según
// el idioma preferido del destinatario; los enlaces apuntan a la versión del sitio en ese idioma (/en/...).
// Se envía también versión de texto plano: accesibilidad (lectores de pantalla) y mejor puntuación anti-spam.
import { appConfig } from "../../../config/app.config";
import { MESSAGES } from "../../../shared/constants/messages.constants";
import { localizedPath, type Locale } from "../../../shared/util/i18n.util";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  // RF-11.2 adjuntos opcionales (factura PDF + XML UBL); "readonly" => el contenido no se modifica al enviar
  attachments?: ReadonlyArray<{ filename: string; content: Buffer; contentType: string }> | undefined;
}

// escapeHtml => evita inyección de HTML/JS en el correo con datos del usuario (nombre, producto, motivo)
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Plantillas dinámicas del panel admin (Fase 7): marcadores "{{ nombre }}" sin motor externo (sin Handlebars) ---
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g; // "{{ firstName }}" => grupo 1 = "firstName"
export type TemplateVariables = Record<string, string | number>;

// extractVariables => nombres de variables usados por la plantilla, sin repetidos (los muestra el editor del panel)
export function extractVariables(...sources: string[]): string[] {
  // "matchAll" => iterador de coincidencias; "new Set" => elimina duplicados
  return [...new Set(sources.flatMap((source) => [...source.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "")))].filter(Boolean);
}

// renderTemplate => reemplaza cada marcador por su valor. "html: true" escapa el valor (anti-inyección de HTML);
// una variable sin valor se deja vacía (nunca se envía "{{ x }}" literal al cliente). Función pura.
export function renderTemplate(source: string, variables: TemplateVariables, html: boolean): string {
  return source.replace(PLACEHOLDER, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined) return "";
    return html ? escapeHtml(String(value)) : String(value);
  });
}

// htmlToText => versión de texto plano mínima para clientes sin HTML (accesibilidad y anti-spam)
export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/h\d|\/li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// frontendUrl => URL absoluta del frontend en el idioma del destinatario
export const frontendUrl = (locale: Locale, path: string): string => `${appConfig.FRONTEND_URL}${localizedPath(locale, path)}`;

// layout => estructura HTML común. Tablas + estilos inline: la única forma robusta en clientes de correo
function layout(locale: Locale, title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const t = MESSAGES[locale].email;
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(cta.label)}</a></p>
       <p style="font-size:12px;color:#64748b">${escapeHtml(t.linkFallback)} ${cta.url}</p>`
    : "";
  // lang="<idioma>" => los lectores de pantalla leen el correo con la pronunciación correcta
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px">
  <tr><td><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${bodyHtml}${button}
  <p style="font-size:12px;color:#94a3b8;margin-top:32px">${escapeHtml(t.footer)}</p>
  </td></tr></table></td></tr></table></body></html>`;
}

// Cada plantilla es una función pura: mismo input => mismo output (fácil de testear)
export const EmailTemplates = {
  verifyEmail: (locale: Locale, data: { firstName: string; userId: string; token: string }): EmailContent => {
    const t = MESSAGES[locale].email.verify;
    // "encodeURIComponent" => el token viaja seguro dentro de la URL
    const url = `${frontendUrl(locale, `/verify/${encodeURIComponent(data.token)}`)}?uid=${data.userId}`;
    return {
      subject: t.subject,
      html: layout(locale, t.heading(data.firstName), `<p>${escapeHtml(t.body)}</p>`, { label: t.cta, url }),
      text: t.text(data.firstName, url),
    };
  },

  passwordReset: (locale: Locale, data: { firstName: string; token: string }): EmailContent => {
    const t = MESSAGES[locale].email.reset;
    const url = `${frontendUrl(locale, "/forgot-password")}?token=${encodeURIComponent(data.token)}`;
    return {
      subject: t.subject,
      html: layout(locale, t.heading(data.firstName), `<p>${escapeHtml(t.body)}</p>`, { label: t.cta, url }),
      text: t.text(url),
    };
  },

  passwordChanged: (locale: Locale, data: { firstName: string }): EmailContent => {
    const t = MESSAGES[locale].email.passwordChanged;
    return { subject: t.subject, html: layout(locale, t.heading(data.firstName), `<p>${escapeHtml(t.body)}</p>`), text: t.text };
  },

  twoFactorCode: (locale: Locale, data: { firstName: string; code: string }): EmailContent => {
    const t = MESSAGES[locale].email.twoFactor;
    return {
      subject: t.subject(data.code),
      html: layout(locale, t.heading(data.firstName), `<p style="font-size:32px;letter-spacing:8px;font-weight:bold">${escapeHtml(data.code)}</p><p>${escapeHtml(t.expires)}</p>`),
      text: t.text(data.code),
    };
  },

  // welcome => RF-01.5 bienvenida al activar la cuenta; el botón lleva a la tienda en el idioma del usuario
  welcome: (locale: Locale, data: { firstName: string }): EmailContent => {
    const t = MESSAGES[locale].email.welcome;
    const url = frontendUrl(locale, "/");
    return { subject: t.subject, html: layout(locale, t.heading(data.firstName), `<p>${escapeHtml(t.body)}</p>`, { label: t.cta, url }), text: t.text(data.firstName, url) };
  },

  // magicLink => RF-01.3 enlace de acceso sin contraseña (página /login/magic de Next canjea el token)
  magicLink: (locale: Locale, data: { firstName: string; token: string }): EmailContent => {
    const t = MESSAGES[locale].email.magicLink;
    const url = `${frontendUrl(locale, "/login/magic")}?token=${encodeURIComponent(data.token)}`;
    return { subject: t.subject, html: layout(locale, t.heading(data.firstName), `<p>${escapeHtml(t.body)}</p>`, { label: t.cta, url }), text: t.text(url) };
  },

  // notification => plantilla genérica usada por el módulo Notification (canal EMAIL); title/body ya vienen traducidos
  notification: (locale: Locale, data: { title: string; body: string; url?: string | undefined }): EmailContent => ({
    subject: data.title,
    html: layout(locale, data.title, `<p>${escapeHtml(data.body)}</p>`, data.url ? { label: MESSAGES[locale].email.viewDetail, url: data.url } : undefined),
    text: data.url ? `${data.body}\n${data.url}` : data.body,
  }),
};
