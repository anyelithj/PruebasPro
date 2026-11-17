import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Song } from '../../domain/entities/song.entity';
import { SongLine } from '../../domain/entities/song-line.entity';
import { WEB_PAGE_FETCHER, type WebPageFetcher } from '../../domain/interfaces/web-page-fetcher.interface';
import { decodeBody } from '../../domain/lyrics-text';
import { captionCues, captionTracks, lrcCues, pickTrack, timeLyricLines, youtubeVideoId, type CaptionCue } from '../../domain/youtube-lyrics';
// [CaptionTimings · 2026-11-06 · Letra desfasada en vídeos de YouTube]: sin tiempos guardados el reproductor los ESTIMA por longitud → el marcador no iba con la voz
// Si la canción es un vídeo de YouTube y NINGÚN verso tiene tiempo, se toman de sus subtítulos (tStartMs) y se guardan como «auto» (lo manual nunca se pisa) | una vez por canción y proceso
// [Patrón]: Service + Port (WebPageFetcher) | [Principio]: Fail Soft (sin subtítulos o YouTube caído → los versos salen como estaban) + DRY (GetSong y ListSongLines)

@Injectable()
export class CaptionTimings {
  private readonly logger = new Logger(CaptionTimings.name);
  private readonly tried = new Set<string>(); // ponytail: memoria del proceso; columna «captions_checked_at» si hay varias réplicas

  constructor(
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
    @Inject(WEB_PAGE_FETCHER) private readonly fetcher: WebPageFetcher,
  ) {}

  async fill(song: Song, rows: SongLine[]): Promise<SongLine[]> {
    if (!rows.length || rows.some((r) => r.startS != null) || this.tried.has(song.id)) return rows;
    this.tried.add(song.id);
    const texts = rows.map((r) => r.text);
    // [2026-11-09 · «la letra arranca a los 15 s y el cantante a los 38 s»]: muchos vídeos no traen subtítulos → 2.ª fuente: LRCLIB (letras sincronizadas LRC públicas)
    const times = (await this.fromYouTube(song, texts)) ?? (await this.fromLrclib(song, texts));
    if (!times) return rows;
    const timed = rows.filter((_, i) => times[i]);
    rows.forEach((r, i) => {
      const t = times[i];
      if (t) Object.assign(r, { startS: t.start, endS: t.end, timingSource: 'auto' as const });
    });
    await this.lines.save(timed).catch((err: unknown) => this.logger.warn(`Guardar tiempos (${song.id}): ${String(err)}`));
    return rows;
  }

  // Casan menos de la mitad → los tiempos son de otra cosa (null)
  private matched(texts: string[], cues: CaptionCue[]): Times | null {
    const times = timeLyricLines(texts, cues);
    return times.filter(Boolean).length >= texts.length / 2 ? times : null;
  }

  private async fromYouTube(song: Song, texts: string[]): Promise<Times | null> {
    const videoId = song.embedUrl ? youtubeVideoId(song.embedUrl) : null;
    if (!videoId) return null;
    try {
      const page = await this.fetcher.fetch(`https://www.youtube.com/watch?v=${videoId}&hl=${encodeURIComponent(song.language)}`);
      const track = pickTrack(captionTracks(decodeBody(page.body, page.contentType)), song.language);
      if (!track) return null;
      const res = await this.fetcher.fetch(`${track.baseUrl}&fmt=json3`);
      return this.matched(texts, captionCues(decodeBody(res.body, res.contentType)));
    } catch (err) {
      this.logger.warn(`Tiempos desde subtítulos (${videoId}): ${String(err)}`);
      return null;
    }
  }

  // [fromLrclib]: búsqueda por título (+ artista) → primer resultado con letra sincronizada que case con los versos guardados
  private async fromLrclib(song: Song, texts: string[]): Promise<Times | null> {
    try {
      const q = new URLSearchParams({ track_name: song.title, ...(song.artist ? { artist_name: song.artist } : {}) });
      let hits = await this.lrclib(q);
      if (!hits.some((h) => h.syncedLyrics) && song.artist) hits = await this.lrclib(new URLSearchParams({ track_name: song.title }));
      for (const h of hits) {
        const times = h.syncedLyrics ? this.matched(texts, lrcCues(h.syncedLyrics)) : null;
        if (times) return times;
      }
    } catch (err) {
      this.logger.warn(`Tiempos desde LRCLIB (${song.title}): ${String(err)}`);
    }
    return null;
  }

  private async lrclib(q: URLSearchParams): Promise<Array<{ syncedLyrics?: string | null }>> {
    const res = await this.fetcher.fetch(`https://lrclib.net/api/search?${q}`);
    const data = JSON.parse(decodeBody(res.body, res.contentType)) as unknown;
    return Array.isArray(data) ? data.filter((h: { syncedLyrics?: string | null }) => h.syncedLyrics).slice(0, 8) : []; // Solo las que traen tiempos
  }
}

type Times = Array<{ start: number; end: number } | null>;
