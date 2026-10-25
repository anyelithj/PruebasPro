import { Injectable } from '@nestjs/common';
import type { SongPracticeKind } from '../../domain/entities/song.entity';
import { type MusicActor, SongAccess } from './get-song.use-case';
// [UseCase ListSongPractices · Sprint 9.10 · RF-120]: actividades generadas de una canción (tipo → id de PracticeActivity); se resuelven en /practica/:activityId | [Patrón]: Query | [Principio]: SRP + bajo acoplamiento (Angular Music solo navega a Practice) | [Paradigma]: POO

@Injectable()
export class ListSongPracticesUseCase {
  constructor(private readonly access: SongAccess) {}

  async execute(
    actor: MusicActor,
    songId: string,
  ): Promise<{ kind: SongPracticeKind; activityId: string }[]> {
    const song = await this.access.readable(actor, songId);
    return (
      Object.entries(song.practiceIds) as [SongPracticeKind, string][]
    ).map(([kind, activityId]) => ({ kind, activityId }));
  }
}
