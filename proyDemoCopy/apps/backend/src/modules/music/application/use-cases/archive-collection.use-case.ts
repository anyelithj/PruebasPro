import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SongCollection } from '../../domain/entities/song-collection.entity';
import { GetCollectionUseCase } from './get-collection.use-case';
import type { MusicActor } from './get-song.use-case';
import { assertCollectionEditor } from './update-collection.use-case';
// [UseCase ArchiveCollection · Sprint 9.2]: archiva la colección (borrado lógico); las canciones no se tocan | [Patrón]: Soft Delete | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class ArchiveCollectionUseCase {
  constructor(
    @InjectRepository(SongCollection)
    private readonly collections: Repository<SongCollection>,
    private readonly get: GetCollectionUseCase,
  ) {}

  async execute(actor: MusicActor, id: string): Promise<void> {
    const c = await this.get.load(id);
    assertCollectionEditor(actor, c);
    c.archivedAt = new Date();
    await this.collections.save(c);
  }
}
