import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALIGNMENT } from '../../shared/domain/interfaces/alignment.interface';
import { createObjectStore } from '../../shared/storage/object-store';
import { PracticeModule } from '../practice/practice.module';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { ArchiveCollectionUseCase } from './application/use-cases/archive-collection.use-case';
import { ChangeSongStatusUseCase } from './application/use-cases/change-song-status.use-case';
import { CreateCollectionUseCase } from './application/use-cases/create-collection.use-case';
import { CreateSongUseCase } from './application/use-cases/create-song.use-case';
import { EnrichSongLinesUseCase } from './application/use-cases/enrich-song-lines.use-case';
import { GenerateSongPracticeUseCase } from './application/use-cases/generate-song-practice.use-case';
import { GetCollectionUseCase } from './application/use-cases/get-collection.use-case';
import {
  GetSongUseCase,
  SongAccess,
} from './application/use-cases/get-song.use-case';
import { ListCollectionsUseCase } from './application/use-cases/list-collections.use-case';
import {
  GetSongLineUseCase,
  ListSongLinesUseCase,
} from './application/use-cases/list-song-lines.use-case';
import { ListSongPracticesUseCase } from './application/use-cases/list-song-practices.use-case';
import { ListSongsUseCase } from './application/use-cases/list-songs.use-case';
import { ReplaceSongLinesUseCase } from './application/use-cases/replace-song-lines.use-case';
import { StreamSongAudioUseCase } from './application/use-cases/stream-song-audio.use-case';
import { SyncSongLinesUseCase } from './application/use-cases/sync-song-lines.use-case';
import { UpdateCollectionUseCase } from './application/use-cases/update-collection.use-case';
import {
  MUSIC_STORE,
  UploadSongAudioUseCase,
} from './application/use-cases/upload-song-audio.use-case';
import { WithdrawSongUseCase } from './application/use-cases/withdraw-song.use-case';
import { Song } from './domain/entities/song.entity';
import { SongCollection } from './domain/entities/song-collection.entity';
import { SongLine } from './domain/entities/song-line.entity';
import { AlignmentClient } from './infrastructure/ai/alignment-client.adapter';
import { SongCollectionsController } from './presentation/song-collections.controller';
import { SongLinesController } from './presentation/song-lines.controller';
import { SongPracticesController } from './presentation/song-practices.controller';
import { SongsController } from './presentation/songs.controller';
// [MusicModule · Sprints 9.2/9.10 · RF-115 a RF-120, RF-128]: canciones con licencia y revisión, letra por líneas con IPA y traducción, tiempos (manual o propuestos por Alignment), colecciones y prácticas generadas | [Patrón]: Module + DI Container + Ports & Adapters (LANGUAGE_TOOLS de Vocabulary, ALIGNMENT → AlignmentClient, MUSIC_STORE → ObjectStore «music») | [Principio]: DIP + SRP + DRY (Practice y LanguageTools reutilizados)

@Module({
  imports: [
    TypeOrmModule.forFeature([Song, SongLine, SongCollection]),
    HttpModule,
    VocabularyModule, // LANGUAGE_TOOLS: el mismo cliente de traducción e IPA
    PracticeModule, // CreateActivityUseCase: prácticas de canciones sin tabla propia
  ],
  // [Orden]: rutas con más segmentos fijos antes que «songs/:id»
  controllers: [
    SongCollectionsController,
    SongPracticesController,
    SongLinesController,
    SongsController,
  ],
  providers: [
    { provide: MUSIC_STORE, useFactory: () => createObjectStore('music') },
    { provide: ALIGNMENT, useClass: AlignmentClient },
    SongAccess,
    CreateSongUseCase,
    UploadSongAudioUseCase,
    ListSongsUseCase,
    GetSongUseCase,
    StreamSongAudioUseCase,
    ChangeSongStatusUseCase,
    WithdrawSongUseCase,
    ReplaceSongLinesUseCase,
    EnrichSongLinesUseCase,
    ListSongLinesUseCase,
    GetSongLineUseCase,
    SyncSongLinesUseCase,
    CreateCollectionUseCase,
    ListCollectionsUseCase,
    GetCollectionUseCase,
    UpdateCollectionUseCase,
    ArchiveCollectionUseCase,
    GenerateSongPracticeUseCase,
    ListSongPracticesUseCase,
  ],
  exports: [ALIGNMENT], // [Sprint 9.4]: Dialogues sincroniza el audio de los diálogos con el mismo cliente (DRY)
})
export class MusicModule {}
