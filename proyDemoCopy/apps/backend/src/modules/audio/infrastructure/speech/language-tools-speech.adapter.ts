import { Injectable } from '@nestjs/common';
import { AIClientService } from '../../../ai/ai-client.service';
import type { AudioRequest } from '../../domain/audio-key';
import type {
  SpeechSynthesisPort,
  SynthesizedSpeech,
} from '../../domain/interfaces/speech-synthesis.interface';
// [Adapter voz local · Sprint 4.7]: implementa SpeechSynthesisPort con FastAPI LanguageTools /language-tools/speak (espeak-ng) | [Patrón]: Adapter | [Principio]: DIP + DRY (reutiliza el único cliente HTTP hacia FastAPI, sin dependencias nuevas)

@Injectable()
export class LanguageToolsSpeechAdapter implements SpeechSynthesisPort {
  readonly engine = 'espeak-ng-v2'; // [2026-10-20]: v2 = voz más pausada → claves de caché nuevas // Debe coincidir con el motor de FastAPI (cabecera X-Engine)

  constructor(private readonly ai: AIClientService) {}

  async synthesize(
    req: AudioRequest,
    accessToken: string,
  ): Promise<SynthesizedSpeech> {
    const res = await this.ai.speak(req, accessToken); // 503 si no hay motor; 400 si la variante no corresponde
    return { audio: res.audio, voice: res.voice, engine: res.engine };
  }
}
