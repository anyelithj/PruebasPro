import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetAudioUseCase } from './application/use-cases/get-audio.use-case';
import { InvalidateAudioUseCase } from './application/use-cases/invalidate-audio.use-case';
import { PronunciationAudio } from './domain/entities/pronunciation-audio.entity';
import { AUDIO_STORAGE } from './domain/interfaces/audio-storage.interface';
import { SPEECH_SYNTHESIS } from './domain/interfaces/speech-synthesis.interface';
import { LanguageToolsSpeechAdapter } from './infrastructure/speech/language-tools-speech.adapter';
import { ObjectAudioStorage } from './infrastructure/storage/object-audio.storage';
import { createObjectStore } from '../../shared/storage/object-store';
import { AudioController } from './presentation/audio.controller';
// [AudioModule · Sprint 4.7]: audio de pronunciación con caché (Etapa 6 de la especificación MCER) | [Patrón]: Module + Composition Root (puertos → adaptadores) | [Principio]: DIP (cambiar el almacén o el motor = cambiar el adaptador) | [Tecnología]: NestJS + TypeORM
// AIClientService llega del AIModule (@Global) → no se importa aquí

@Module({
  imports: [TypeOrmModule.forFeature([PronunciationAudio])],
  controllers: [AudioController],
  providers: [
    GetAudioUseCase,
    InvalidateAudioUseCase,
    // [Sprint 6.7]: el almacén lo elige STORAGE_PROVIDER (disco, MinIO o R2) → prefijo «pronunciation-audio»
    {
      provide: AUDIO_STORAGE,
      useFactory: () =>
        new ObjectAudioStorage(createObjectStore('pronunciation-audio')),
    },
    { provide: SPEECH_SYNTHESIS, useClass: LanguageToolsSpeechAdapter },
  ],
})
export class AudioModule {}
