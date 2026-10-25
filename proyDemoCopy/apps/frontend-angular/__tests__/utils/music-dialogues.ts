import { signal } from '@angular/core';
import { SessionService } from '@core/auth/session.service';
// [Fixtures Música y Diálogos · Fase 9]: canción, líneas, colección, tema, diálogo y conversación con la forma de NestJS + sesión falsa por rol | [Patrón]: Test Data Builder | [Principio]: DRY (las specs de las dos funcionalidades)

export const license = { type: 'creative_commons', source: 'https://example.org', holder: 'Aula de Idiomas', variant: 'CC BY 4.0', confirmed: true };

export const line = (i: number, text: string, start: number | null = i * 2) => ({
  id: `l${i}`,
  songId: 's1',
  position: i,
  text,
  ipa: `ipa-uk-${i}`,
  ipaUs: `ipa-us-${i}`,
  translation: `traducción ${i}`,
  startS: start,
  endS: start === null ? null : start + 2,
  timingSource: start === null ? null : 'manual',
  reviewed: false,
  needsNativeReview: false,
});

export const song = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  title: 'Twinkle Twinkle',
  artist: 'Tradicional',
  language: 'en',
  level: 'A1',
  status: 'published',
  license,
  reviewNote: '',
  audioKey: 'songs/s1/a.mp3',
  createdBy: 't1',
  practiceIds: {},
  createdAt: '',
  ...over,
});

export const songDetail = (over: Record<string, unknown> = {}) => ({
  ...song(over),
  lines: [line(0, 'Twinkle, twinkle, little star'), line(1, 'How I wonder what you are')],
  editable: false,
  ...over,
});

export const collection = { id: 'c1', title: 'Canciones infantiles', description: 'Para empezar', language: 'en', level: 'A1', theme: 'infantil', emoji: '🧸', songIds: ['s1'], createdBy: 't1', songCount: 1 };

export const topic = { id: 'tp1', slug: 'food', title: 'Comida', emoji: '🍝', description: '', language: null, levels: ['A1', 'A2'], objectives: ['Di tu comida favorita'], vocabulary: { en: ['pasta', 'spicy'] }, createdBy: null };

export const turn = (i: number, speaker: string, text: string, correction: string | null = null) => ({
  id: `t${i}`,
  position: i,
  speaker,
  text,
  ipa: `ipa-${i}`,
  ipaUs: null,
  translation: `trad ${i}`,
  startS: null,
  endS: null,
  correction,
});

export const dialogue = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: 'En el café',
  topicId: 'tp1',
  language: 'en',
  speakers: ['Ana', 'Tom'],
  level: 'A2',
  levelStatus: 'confirmed',
  levelEstimate: { level: 'A2', confidence: 0.8, method: 'measures', indicators: { avg_sentence_len: 6, words: 40 }, explanation: 'Oraciones cortas.', model: null },
  license,
  audioKey: null,
  createdBy: 't1',
  ...over,
});

export const session = (over: Record<string, unknown> = {}) => ({ id: 'ss1', topicId: 'tp1', language: 'en', level: 'A2', status: 'active', userTurns: 0, vocabularyUsed: [], createdAt: '', ...over });

// [sessionAs]: SessionService falso con el rol pedido (las páginas ocultan acciones según el rol)
export const sessionAs = (role: 'USER' | 'TEACHER' | 'ADMIN', id = 't1') => ({
  provide: SessionService,
  useValue: { user: signal({ id }), role: signal(role), hasRole: (...r: string[]) => r.includes(role) },
});
