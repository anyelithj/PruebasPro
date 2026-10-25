// [Remoto Angular como configuración]: rutas que el shell Next.js reescribe hacia apps/frontend-angular (:9100) | [Patrón]: Configuration Object + SSOT | [Principio]: OCP (pantalla Angular nueva = una entrada) | [Paradigma]: Declarativo
// [Tecnología]: TypeScript puro sin imports → lo leen next.config.ts (rewrites), lib/constants.ts (proxy de sesión) y las páginas que montan Angular Elements
// [Integración]: sin Module Federation — rewrites + Angular Elements + eventos aula:* (mismo origen, misma cookie httpOnly)

// [ANGULAR_PREFIXES]: pantallas completas de Angular (espejo de apps/frontend-angular/src/app/app.routes.ts)
export const ANGULAR_PREFIXES = ["/tutor", "/redaccion", "/estudio", "/notificaciones", "/reportes", "/checkout", "/pagos", "/wallet", "/certificados", "/foros", "/traductor", "/vocabulario", "/juegos", "/practica", "/musica", "/dialogos", "/poliglota", "/gramatica"] as const; // [Sprints 10.7–10.14]: poliglota (tabla comparativa) y gramática (fichas y editor) // [Sprints 9.8–9.14]: música (karaoke con avatar) y diálogos (conversación con el avatar) // [Sprints 8.3/8.8–8.15]: traductor con IPA, banco de vocabulario, juegos y práctica interactiva // [Sprints 7.4/7.7/7.8/7.14]: /checkout (tarjeta y /checkout/cripto), /pagos, /wallet, /certificados y /foros

// [ANGULAR_PUBLIC_PREFIXES]: pantallas Angular SIN sesión (rewrite sí, protección del proxy no) | [Sprint 7.8]: /verificar/:código — el QR del certificado PDF apunta aquí
export const ANGULAR_PUBLIC_PREFIXES = ["/verificar", "/ayuda"] as const; // [Sprint 7.11]: /ayuda — la FAQ es pública (RF-94); el manual lo protege el guard de Angular + JWT en NestJS

// [ANGULAR_ASSETS]: base de los archivos del remoto (deployUrl de angular.json) → main.js y styles.css para los Angular Elements
export const ANGULAR_ASSETS = "/ng";

// [ANGULAR_URL]: origen del remoto (solo servidor: lo usan los rewrites) | Docker → http://frontend-angular:9100
export const ANGULAR_URL = process.env.ANGULAR_URL ?? "http://localhost:9100";
