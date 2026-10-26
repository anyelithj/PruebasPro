import { cleanStanzas } from '../../../src/modules/music/infrastructure/ai/lyrics-draft-client.adapter';
import {
  blockersMessage,
  songBlockers,
} from '../../../src/modules/music/domain/song-readiness';
import type { License } from '../../../src/modules/music/domain/value-objects/license.vo';
// [Pruebas · 2026-10-24]: requisitos de publicación (SSOT de la UI y del 400) y limpieza del JSON de la letra generada por IA

const LICENSE: License = { type: 'own_work', source: '', holder: 'Aula', confirmed: true };

describe('songBlockers', () => {
  it('lista todo lo que falta, en orden', () => {
    expect(songBlockers({ license: { ...LICENSE, confirmed: false }, audioKey: null }, 0)).toEqual(['license', 'audio', 'lyrics']);
  });

  it('vacía cuando la canción está lista', () => {
    expect(songBlockers({ license: LICENSE, audioKey: 'songs/1/a.mp3' }, 12)).toEqual([]);
  });

  it('el mensaje del 400 enumera los motivos (licencia con su motivo concreto)', () => {
    const song = { license: { ...LICENSE, confirmed: false }, audioKey: null };
    expect(blockersMessage(song, songBlockers(song, 3))).toBe('Confirma que tienes derecho a publicarlo · Falta subir el audio');
    expect(blockersMessage(song, [])).toBeNull();
  });
});

describe('cleanStanzas (letra de la IA)', () => {
  it('quita etiquetas, numeración y estrofas vacías; acepta estrofas como string', () => {
    expect(cleanStanzas([['[Chorus]', '1. Sing with me', '- every day'], [], 'Line a\nLine b', 42])).toEqual([
      ['Sing with me', 'every day'],
      ['Line a', 'Line b'],
    ]);
  });

  it('JSON inesperado → sin estrofas', () => {
    expect(cleanStanzas({ nope: true })).toEqual([]);
  });
});
