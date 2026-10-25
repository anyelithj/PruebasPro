import type { Routes } from '@angular/router';
// [Rutas raíz · Angular 22]: una entrada lazy por funcionalidad (loadChildren → <nombre>.routes.ts) | [Patrón]: Lazy Loading + Front Controller | [Principio]: OCP (funcionalidad nueva = una línea) + bajo acoplamiento (app no importa el código de las funcionalidades)
// [Integración]: Next.js reescribe estas mismas rutas hacia el remoto Angular (apps/frontend-next/next.config.ts · ANGULAR_ROUTES)

export const routes: Routes = [
  {
    path: 'tutor',
    loadChildren: () =>
      import('@features/assistant/assistant.routes').then((m) => m.ASSISTANT_ROUTES),
  },
  {
    path: 'redaccion',
    loadChildren: () => import('@features/own-llm/own-llm.routes').then((m) => m.OWN_LLM_ROUTES),
  },
  {
    path: 'estudio',
    loadChildren: () => import('@features/feedback/feedback.routes').then((m) => m.FEEDBACK_ROUTES),
  },
  {
    path: 'notificaciones',
    loadChildren: () =>
      import('@features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
  },
  {
    path: 'reportes',
    loadChildren: () => import('@features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
  },
  // [Sprint 7.7]: pago con ETH de prueba (Sepolia) y billetera SIWE | `checkout/cripto` va ANTES de `checkout` (ruta más específica primero)
  {
    path: 'checkout/cripto',
    loadChildren: () => import('@features/web3/web3.routes').then((m) => m.CRYPTO_ROUTES),
  },
  {
    path: 'wallet',
    loadChildren: () => import('@features/web3/web3.routes').then((m) => m.WALLET_ROUTES),
  },
  // [Sprint 7.4]: checkout con Stripe (tarjeta) e historial de pagos
  {
    path: 'checkout',
    loadChildren: () => import('@features/payments/payments.routes').then((m) => m.CHECKOUT_ROUTES),
  },
  {
    path: 'pagos',
    loadChildren: () => import('@features/payments/payments.routes').then((m) => m.PAYMENTS_ROUTES),
  },
  // [Sprint 7.8]: mis certificados (con sesión) y verificación pública por código o hash de Sepolia (sin sesión)
  {
    path: 'certificados',
    loadChildren: () =>
      import('@features/certificates/certificates.routes').then((m) => m.CERTIFICATES_ROUTES),
  },
  {
    path: 'verificar',
    loadChildren: () =>
      import('@features/certificates/certificates.routes').then((m) => m.VERIFY_ROUTES),
  },
  // [Sprint 7.11]: Centro de ayuda — FAQ pública, manual por rol y Agente Guía
  // [Sprint 7.14]: foros por lección
  {
    path: 'foros',
    loadChildren: () => import('@features/forums/forums.routes').then((m) => m.FORUMS_ROUTES),
  },
  {
    path: 'ayuda',
    loadChildren: () => import('@features/help/help.routes').then((m) => m.HELP_ROUTES),
  },
  // [Sprint 8.3]: traductor con IPA UK/US y banco de vocabulario
  {
    path: 'traductor',
    loadChildren: () =>
      import('@features/vocabulary/vocabulary.routes').then((m) => m.TRANSLATOR_ROUTES),
  },
  {
    path: 'vocabulario',
    loadChildren: () =>
      import('@features/vocabulary/vocabulary.routes').then((m) => m.VOCABULARY_ROUTES),
  },
  // [Sprints 8.8–8.11]: juegos de vocabulario, fluidez, comprensión, role-play y métricas
  {
    path: 'juegos',
    loadChildren: () => import('@features/games/games.routes').then((m) => m.GAMES_ROUTES),
  },
  // [Sprints 8.14/8.15]: práctica interactiva con corrección y constructor de actividades (docente)
  {
    path: 'practica',
    loadChildren: () => import('@features/practice/practice.routes').then((m) => m.PRACTICE_ROUTES),
  },
  // [Sprints 9.8–9.13]: música con karaoke y avatar, diálogos guionados y conversación con el avatar
  {
    path: 'musica',
    loadChildren: () => import('@features/music/music.routes').then((m) => m.MUSIC_ROUTES),
  },
  {
    path: 'dialogos',
    loadChildren: () =>
      import('@features/dialogues/dialogues.routes').then((m) => m.DIALOGUES_ROUTES),
  },
  // [Sprints 10.7–10.12]: comparador poliglota por tema y fichas de gramática con editor
  {
    path: 'poliglota',
    loadChildren: () => import('@features/polyglot/polyglot.routes').then((m) => m.POLYGLOT_ROUTES),
  },
  {
    path: 'gramatica',
    loadChildren: () => import('@features/grammar/grammar.routes').then((m) => m.GRAMMAR_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'tutor' },
  { path: '**', redirectTo: 'tutor' }, // Ruta desconocida dentro del remoto → pantalla principal
];
