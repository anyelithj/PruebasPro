import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Readable } from 'stream';
import { QueryFailedError, Repository } from 'typeorm';
import {
  DEFAULT_VARIANT,
  type Language,
} from '../../../../shared/domain/language.vo';
import {
  audioKey,
  objectKey,
  type AudioRequest,
  type ByteRange,
} from '../../domain/audio-key';
import { PronunciationAudio } from '../../domain/entities/pronunciation-audio.entity';
import {
  AUDIO_STORAGE,
  type AudioStoragePort,
} from '../../domain/interfaces/audio-storage.interface';
import {
  SPEECH_SYNTHESIS,
  type SpeechSynthesisPort,
} from '../../domain/interfaces/speech-synthesis.interface';
// [Use Case GetAudio · Sprint 4.7]: devuelve el audio de la caché o lo genera UNA sola vez y lo guarda | [Patrón]: Cache-Aside + Command | [Principio]: SRP + DIP + «generar solo al pedirlo» | [Paradigma]: POO + async/await

export interface GetAudioInput {
  text: string;
  language: Language;
  variant?: string;
}

// [Resultado]: tamaño total + función para abrir el flujo (con o sin rango) → el controlador decide 200 o 206
export interface AudioHandle {
  key: string;
  size: number;
  cached: boolean; // true = no se llamó al motor de voz
  variant: string;
  open: (range?: ByteRange) => Promise<Readable>;
}

@Injectable()
export class GetAudioUseCase {
  private readonly logger = new Logger(GetAudioUseCase.name);

  constructor(
    @InjectRepository(PronunciationAudio)
    private readonly audios: Repository<PronunciationAudio>,
    @Inject(AUDIO_STORAGE) private readonly storage: AudioStoragePort,
    @Inject(SPEECH_SYNTHESIS) private readonly speech: SpeechSynthesisPort,
  ) {}

  async execute(
    input: GetAudioInput,
    accessToken: string,
  ): Promise<AudioHandle> {
    const req: AudioRequest = {
      text: input.text.trim(),
      language: input.language,
      variant: input.variant ?? DEFAULT_VARIANT[input.language],
    };
    const key = audioKey(req, this.speech.engine);

    // ── 1) Caché: registro + objeto en el almacén → se sirve sin llamar al motor
    const hit = await this.audios.findOne({ where: { cacheKey: key } });
    if (hit) {
      const size = await this.storage.size(hit.objectKey);
      if (size !== null)
        return this.handle(key, size, true, hit.variant, hit.objectKey);
      await this.audios.delete({ id: hit.id }); // El objeto se borró a mano → la caché se reconstruye sola
    }

    // ── 2) Generar una sola vez: voz local → almacén (disco, MinIO o R2) → registro trazable
    const speech = await this.speech.synthesize(req, accessToken);
    const path = objectKey(req, key);
    await this.storage.put(path, speech.audio, 'audio/wav');
    try {
      await this.audios.insert({
        cacheKey: key,
        text: req.text,
        language: req.language,
        variant: req.variant,
        voice: speech.voice,
        engine: speech.engine || this.speech.engine,
        objectKey: path,
        sizeBytes: speech.audio.length,
      });
    } catch (err) {
      // [Carrera]: dos peticiones simultáneas generaron el mismo audio → la clave única gana una; el objeto es idéntico
      if (!(err instanceof QueryFailedError)) throw err;
      this.logger.debug(`Audio ${key} ya registrado por otra petición`);
    }
    // El audio recién generado se sirve desde memoria (no hace falta volver a leerlo del almacén)
    return {
      key,
      size: speech.audio.length,
      cached: false,
      variant: req.variant,
      open: (range) =>
        Promise.resolve(
          Readable.from(
            range
              ? speech.audio.subarray(range.start, range.end + 1)
              : speech.audio,
          ),
        ),
    };
  }

  // [handle]: audio en el almacén, leído por rangos bajo demanda
  private handle(
    key: string,
    size: number,
    cached: boolean,
    variant: string,
    path: string,
  ): AudioHandle {
    return {
      key,
      size,
      cached,
      variant,
      open: (range) => this.storage.read(path, range),
    };
  }
}
