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
  readonly engine = 'espeak-ng-v3'; // [2026-10-24]: v3 = WAV con cabecera correcta (antes stdout con tamaños 0x7FFFF000) → la caché vieja se regenera sola // Debe coincidir con el motor de FastAPI (cabecera X-Engine)

  constructor(private readonly ai: AIClientService) {}

  async synthesize(
    req: AudioRequest,
    accessToken: string,
  ): Promise<SynthesizedSpeech> {
    const res = await this.ai.speak(req, accessToken); // 503 si no hay motor; 400 si la variante no corresponde
    return { audio: res.audio, voice: res.voice, engine: res.engine };
  }
}
