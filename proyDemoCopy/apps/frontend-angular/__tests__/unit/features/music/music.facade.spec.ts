import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { MusicFacade } from '@features/music/application/music.facade';
import { SongPlayerFacade } from '@features/music/application/song-player.facade';
import { MusicRepository } from '@features/music/domain/music.repository.port';
import { fmtTime, tapTimings, type SongDetail } from '@features/music/domain/models/music';
import { lineAt } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
import { collection, song, songDetail } from '@testing/music-dialogues';
// [Spec MusicFacade + SongPlayerFacade · Sprints 9.8–9.10]: colecciones con estado vacío, asistente de subida (letra sin IPA = aviso), revisión que saca de la cola, práctica → id de actividad y línea actual del karaoke | [Patrón]: Test Double (repositorio falso)

function setup(overrides: Partial<MusicRepository> = {}) {
  const repo = {
    listCollections: jest.fn(() => of([collection])),
    updateCollection: jest.fn((_id: string, p: { songIds: string[] }) => of({ ...collection, songIds: p.songIds })),
    listSongs: jest.fn(() => of([song({ status: 'review' })])),
    getSong: jest.fn(() => of(songDetail())),
    loadLyrics: jest.fn(() => of({ lines: [], enriched: false })),
    patchLines: jest.fn(() => of(songDetail().lines)),
    changeStatus: jest.fn(() => of(song())),
    generatePractice: jest.fn(() => of({ kind: 'gap_fill', activityId: 'a9', reused: false })),
    ...overrides,
  } as unknown as MusicRepository;
  TestBed.configureTestingModule({ providers: [MusicFacade, SongPlayerFacade, { provide: MusicRepository, useValue: repo }] });
  return { music: TestBed.inject(MusicFacade), player: TestBed.inject(SongPlayerFacade), repo };
}

describe('MusicFacade', () => {
  it('colecciones con datos → «success»', async () => {
    const { music } = setup();
    await music.loadCollections({ language: 'en' });
    expect(music.collections.status()).toBe('success');
  });

  it('sin colecciones → «empty»', async () => {
    const { music } = setup({ listCollections: () => of([]) } as never);
    await music.loadCollections({});
    expect(music.collections.status()).toBe('empty');
  });

  it('agregar a la colección envía el orden nuevo sin repetidos', async () => {
    const { music, repo } = setup();
    await music.loadCollections({});
    expect(await music.toggleInCollection(collection, 's2')).toBe(true);
    expect(repo.updateCollection).toHaveBeenCalledWith('c1', { songIds: ['s1', 's2'] });
  });

  it('letra guardada sin IPA (FastAPI caído) → false para avisar; recarga la canción', async () => {
    const { music, repo } = setup();
    expect(await music.loadLyrics('s1', 'Hello\nBye')).toBe(false);
    expect(repo.getSong).toHaveBeenCalledWith('s1');
  });

  it('el ADMIN publica y la canción sale de la cola', async () => {
    const { music } = setup();
    await music.loadReviewQueue();
    expect(await music.review('s1', 'published')).toBe(true);
    expect(music.reviewQueue.data()).toEqual([]);
  });

  it('enviar a revisión sin audio → error visible', async () => {
    const { music } = setup({ changeStatus: () => throwError(() => new ApiError(400, 'Falta el audio')) } as never);
    expect(await music.submitForReview('s1')).toBe(false);
    expect(music.actionError()).toContain('Falta el audio');
  });

  it('practicar devuelve el id de la actividad de Practice', async () => {
    expect(await setup().music.practice('s1', 'gap_fill')).toBe('a9');
  });
});

describe('SongPlayerFacade y funciones puras', () => {
  it('la línea actual sigue el tiempo del audio', () => {
    const { player } = setup();
    player.song.set(songDetail() as SongDetail);
    player.time.set(2.5);
    expect(player.current()).toBe(1);
    player.time.set(9);
    expect(player.current()).toBe(-1); // Después de la última línea
  });

  it('lineAt ignora líneas sin tiempos; tapTimings cierra cada verso con el siguiente', () => {
    expect(lineAt([{ id: 'a', text: 'x', ipa: '', translation: null }], 1)).toBe(-1);
    expect(tapTimings([0.5, null, 4], 10)).toEqual([
      { startS: 0.5, endS: 4 },
      { startS: 4, endS: 10 },
    ]);
    expect(fmtTime(75.4)).toBe('1:15');
  });
});
