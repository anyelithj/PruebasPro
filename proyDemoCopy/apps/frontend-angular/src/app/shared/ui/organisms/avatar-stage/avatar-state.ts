// [Modelo AvatarState · Sprint 9.7]: estados del avatar — en reposo, escuchando, pensando, hablando y cantando | [Patrón]: State Machine (tipo literal) | [Principio]: SSOT (lo usan AvatarStage, la conversación y el reproductor de canciones) | [Paradigma]: Declarativo

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'singing';

// [Textos del estado]: los pasa el contenedor (i18n) → el organismo no depende del diccionario
export type AvatarStateLabels = Record<AvatarState, string>;

// [moves]: ¿la boca se mueve en este estado? | Función pura
export const moves = (s: AvatarState): boolean => s === 'speaking' || s === 'singing';
