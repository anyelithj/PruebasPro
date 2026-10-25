import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SongCollection } from '../../domain/entities/song-collection.entity';
import type { CollectionInput } from './create-collection.use-case';
import { GetCollectionUseCase } from './get-collection.use-case';
import type { MusicActor } from './get-song.use-case';
// [UseCases UpdateCollection + guard de autor · Sprint 9.2 · RF-115]: edita nombre, descripción y canciones (y su orden); solo su autor o un ADMIN | [Patrón]: Use Case (Command) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

export function assertCollectionEditor(
  actor: MusicActor,
  c: SongCollection,
): void {
  if (actor.role !== 'ADMIN' && c.createdBy !== actor.id)
    throw new ForbiddenException(
      'Solo el autor o un ADMIN puede editar la colección',
    );
}

@Injectable()
export class UpdateCollectionUseCase {
  constructor(
    @InjectRepository(SongCollection)
    private readonly collections: Repository<SongCollection>,
    private readonly get: GetCollectionUseCase,
  ) {}

  async execute(
    actor: MusicActor,
    id: string,
    patch: Partial<CollectionInput>,
  ): Promise<SongCollection> {
    const c = await this.get.load(id);
    assertCollectionEditor(actor, c);
    const { songIds, ...fields } = patch;
    Object.assign(
      c,
      Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined),
      ),
    );
    if (songIds) c.songIds = [...new Set(songIds)];
    return this.collections.save(c);
  }
}
