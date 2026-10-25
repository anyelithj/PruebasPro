import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { MusicHttpRepository } from '@features/music/infrastructure/music.http-repository';
import { collection, song, songDetail } from '@testing/music-dialogues';
// [Spec MusicHttpRepository · Sprints 9.8–9.10]: filtros como query (solo con valor), letra por POST, lote de correcciones con su origen, audio multipart y 413 → ApiError | [Herramienta]: msw 2

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), MusicHttpRepository] });
  return TestBed.inject(MusicHttpRepository);
}

describe('MusicHttpRepository', () => {
  it('listSongs: solo los filtros con valor viajan; mapea la canción', async () => {
    let url = '';
    server.use(
      http.get(`${API}/music/songs`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(envelope([song()]));
      }),
    );
    const r = await firstValueFrom(setup().listSongs({ language: 'en', level: '', mine: false }));
    expect(new URL(url).searchParams.toString()).toBe('language=en');
    expect(r[0].license.holder).toBe('Aula de Idiomas');
  });

  it('colección con canciones · letra · lote de tiempos con timingSource', async () => {
    let lyrics: unknown;
    let patch: unknown;
    server.use(
      http.get(`${API}/music/collections/c1`, () => HttpResponse.json(envelope({ ...collection, songs: [song()] }))),
      http.post(`${API}/music/songs/s1/lines`, async ({ request }) => {
        lyrics = await request.json();
        return HttpResponse.json(envelope({ lines: songDetail().lines, enriched: true }), { status: 201 });
      }),
      http.patch(`${API}/music/songs/s1/lines`, async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json(envelope(songDetail().lines));
      }),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.getCollection('c1'))).songs).toHaveLength(1);
    expect((await firstValueFrom(repo.loadLyrics('s1', 'a\nb'))).enriched).toBe(true);
    expect(lyrics).toEqual({ lyrics: 'a\nb', auto: true }); // [2026-10-19]: modo automático por defecto
    await firstValueFrom(repo.patchLines('s1', [{ id: 'l0', startS: 0, endS: 2 }], 'manual'));
    expect(patch).toEqual({ lines: [{ id: 'l0', startS: 0, endS: 2 }], timingSource: 'manual' });
    expect(repo.audioUrl('s1')).toBe(`${API}/music/songs/s1/audio`);
  });

  it('audio demasiado grande → 413 del BFF como ApiError', async () => {
    server.use(http.post(`${API}/music/songs/s1/audio`, () => HttpResponse.json({ message: 'El archivo supera el tamaño máximo permitido' }, { status: 413 })));
    await expect(firstValueFrom(setup().uploadAudio('s1', new Blob(['x'])))).rejects.toEqual(new ApiError(413, 'El archivo supera el tamaño máximo permitido'));
  });
});
