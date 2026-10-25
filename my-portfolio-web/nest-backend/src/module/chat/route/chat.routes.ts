// [DRY] constantes de rutas del chat IA
export const CHAT_ROUTES = {
  ROOT: 'chat',
  HISTORY: 'history/:sessionId',
  STREAM: 'stream',
  SETTINGS: 'settings', // GET/PATCH system prompt (admin)
  SESSIONS: 'sessions', // GET lista de sesiones (admin)
} as const;
