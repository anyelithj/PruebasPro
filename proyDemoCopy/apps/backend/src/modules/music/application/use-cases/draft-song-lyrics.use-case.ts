import { Inject, Injectable } from '@nestjs/common';
import {
  type LyricsDraftInput,
  LYRICS_DRAFT,
  type LyricsDraftPort,
} from '../../domain/interfaces/lyrics-draft.interface';
// [UseCase DraftSongLyrics · 2026-10-24 · RF-117]: BORRADOR de letra con IA (idioma, nivel y tema) para el asistente «Subir canción» — no guarda nada: el docente revisa/edita el texto, crea la canción y lo carga con POST /songs/:id/lines (mismo camino que una letra pegada → IPA, traducción, tiempos y revisión del ADMIN)
// [Patrón]: Use Case (Query) + Port (LyricsDraftPort) | [Principio]: SRP + DIP + revisión humana (lo generado se marca como IA) | [Paradigma]: POO + funcional

export interface SongLyricsDraft {
  title: string;
  lyrics: string; // Un verso por línea; una línea vacía entre estrofas (formato que entiende splitLyrics)
  lines: number;
  model: string;
  source: 'llm';
}

@Injectable()
export class DraftSongLyricsUseCase {
  constructor(@Inject(LYRICS_DRAFT) private readonly ai: LyricsDraftPort) {}

  async execute(input: LyricsDraftInput): Promise<SongLyricsDraft> {
    const draft = await this.ai.draft(input);
    return {
      title: draft.title,
      lyrics: draft.stanzas.map((st) => st.join('\n')).join('\n\n'), // Estrofas separadas por una línea vacía
      lines: draft.stanzas.flat().length, // `flat` (ES2019): estrofas → versos
      model: draft.model,
      source: 'llm',
    };
  }
}
