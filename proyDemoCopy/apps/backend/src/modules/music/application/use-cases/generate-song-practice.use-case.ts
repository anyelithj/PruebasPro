import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateActivityUseCase,
  type ItemInput,
} from '../../../practice/application/use-cases/create-activity.use-case';
import type { Skill } from '../../../practice/domain/item-type';
import { Song, type SongPracticeKind } from '../../domain/entities/song.entity';
import { SongLine } from '../../domain/entities/song-line.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase GenerateSongPractice · Sprint 9.10 · RF-120]: crea una actividad de Practice a partir de la letra — completar la letra, ordenar versos o marcar la palabra intrusa — y la reutiliza si ya existe | [Patrón]: Use Case (Command) + Builder (buildSongPractice, función pura) | [Principio]: DRY (reutiliza PracticeActivity/PracticeItem y su reproductor; sin tabla propia) + determinístico (sin LLM: mismos ítems para la misma letra) | [Paradigma]: POO + funcional

const MAX_ITEMS = 8;
const LABEL: Record<SongPracticeKind, { title: string; skill: Skill }> = {
  gap_fill: { title: 'Completar la letra', skill: 'vocabulary' },
  order_lines: { title: 'Ordenar los versos', skill: 'structure' },
  mark_words: { title: 'Marcar la palabra intrusa', skill: 'vocabulary' },
};

const tokens = (line: string) => line.split(/\s+/).filter(Boolean);
const bare = (w: string) => w.replace(/[^\p{L}\p{N}'’-]/gu, ''); // Sin signos de puntuación (Unicode: vale para cirílico y acentos)
// [keyWord]: índice de la palabra más larga (≥ 3 letras) — suele ser una palabra con contenido, no un artículo | Función pura
const keyWord = (line: string): number => {
  let best = -1;
  tokens(line).forEach((w, i) => {
    if (
      bare(w).length >= 3 &&
      (best < 0 || bare(w).length > bare(tokens(line)[best]).length)
    )
      best = i;
  });
  return best;
};

// [buildSongPractice]: ítems deterministas a partir de las líneas | `export` → testeable sin BD
export function buildSongPractice(
  texts: string[],
  kind: SongPracticeKind,
): ItemInput[] {
  const skill = LABEL[kind].skill;
  const usable = texts
    .map((t, i) => ({ t, i, k: keyWord(t) }))
    .filter((x) => x.k >= 0);
  if (kind === 'order_lines') {
    const verse = [...new Set(texts)].slice(0, 6); // Primeros versos sin repetir el estribillo
    if (verse.length < 3) return [];
    const shuffled = [...verse].sort((a, b) => a.localeCompare(b)); // Orden alfabético: estable y distinto del original…
    if (shuffled.join('|') === verse.join('|')) shuffled.reverse(); // …y si coincidiera, al revés
    return [
      {
        itemType: 'drag_order',
        skill,
        prompt: 'Ordena los versos como suenan en la canción',
        options: shuffled,
        accepted: [verse],
        explanation: verse.join(' / '),
        tip: 'Escucha la canción con la letra oculta y repite.',
      },
    ];
  }
  return usable.slice(0, MAX_ITEMS).flatMap(({ t, i, k }, n): ItemInput[] => {
    const words = tokens(t);
    const word = bare(words[k]);
    if (kind === 'gap_fill') {
      const prompt = words
        .map((w, j) => (j === k ? w.replace(word, '___') : w))
        .join(' ');
      return [
        {
          itemType: 'fill_blank' as const,
          skill,
          prompt,
          accepted: [[word]],
          explanation: `La línea ${i + 1} dice: «${t}».`,
          tip: 'Escucha la línea a 0,75x si no la entiendes.',
        },
      ];
    }
    // mark_words: la palabra clave se cambia por la palabra clave de otra línea → el estudiante marca la intrusa
    const other = usable
      .map((u) => bare(tokens(u.t)[u.k]))
      .find((w, j) => j !== n && w.toLowerCase() !== word.toLowerCase());
    if (!other) return [];
    const prompt = words
      .map((w, j) => (j === k ? w.replace(word, other) : w))
      .join(' ');
    return [
      {
        itemType: 'mark_errors' as const,
        skill,
        prompt,
        accepted: [[String(k)]],
        corrections: { [String(k)]: word },
        explanation: `En la canción se canta «${word}», no «${other}».`,
        tip: 'Lee la línea mientras suena y busca la palabra que no encaja.',
      },
    ];
  });
}

@Injectable()
export class GenerateSongPracticeUseCase {
  constructor(
    private readonly access: SongAccess,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(SongLine) private readonly lines: Repository<SongLine>,
    private readonly createActivity: CreateActivityUseCase,
  ) {}

  async execute(
    actor: MusicActor,
    songId: string,
    kind: SongPracticeKind,
  ): Promise<{ kind: SongPracticeKind; activityId: string; reused: boolean }> {
    const song = await this.access.readable(actor, songId);
    if (song.status !== 'published')
      throw new BadRequestException('Solo se practican canciones publicadas');
    const existing = song.practiceIds[kind];
    if (existing) return { kind, activityId: existing, reused: true };
    const texts = (
      await this.lines.find({ where: { songId }, order: { position: 'ASC' } })
    ).map((l) => l.text);
    const items = buildSongPractice(texts, kind);
    if (!items.length)
      throw new BadRequestException(
        'La letra es demasiado corta para esta práctica',
      );
    // [Publicada]: ítems deterministas de una letra ya revisada por el ADMIN → no necesita otra revisión; autor = el de la canción
    const activity = await this.createActivity.execute(
      song.createdBy,
      {
        title: `${song.title} · ${LABEL[kind].title}`,
        description: `Práctica generada de la canción «${song.title}»`,
        language: song.language,
        level: song.level,
        skill: LABEL[kind].skill,
        items,
      },
      { published: true },
    );
    song.practiceIds = { ...song.practiceIds, [kind]: activity.id };
    await this.songs.save(song);
    return { kind, activityId: activity.id, reused: false };
  }
}
