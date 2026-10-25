import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PronunciationAudio } from '../../domain/entities/pronunciation-audio.entity';
import {
  AUDIO_STORAGE,
  type AudioStoragePort,
} from '../../domain/interfaces/audio-storage.interface';
// [Use Case InvalidateAudio · Sprint 4.7]: borra un audio de la caché (objeto + registro) → la próxima petición lo vuelve a generar | [Patrón]: Command | [Principio]: SRP | Uso: un audio salió mal o cambió el motor de voz

@Injectable()
export class InvalidateAudioUseCase {
  constructor(
    @InjectRepository(PronunciationAudio)
    private readonly audios: Repository<PronunciationAudio>,
    @Inject(AUDIO_STORAGE) private readonly storage: AudioStoragePort,
  ) {}

  async execute(key: string): Promise<{ deleted: true; key: string }> {
    const hit = await this.audios.findOne({ where: { cacheKey: key } });
    if (!hit) throw new NotFoundException(`Audio ${key} no está en la caché`);
    await this.storage.remove(hit.objectKey); // Primero el objeto: si falla, el registro sigue apuntando a algo recuperable
    await this.audios.delete({ id: hit.id });
    return { deleted: true, key };
  }
}
