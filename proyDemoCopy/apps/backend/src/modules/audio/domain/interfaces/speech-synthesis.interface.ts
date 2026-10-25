import type { AudioRequest } from '../audio-key';
// [SpeechSynthesisPort · Sprint 4.7]: voz local (espeak-ng vía FastAPI LanguageTools); el caso de uso no conoce HTTP ni el motor | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP

export const SPEECH_SYNTHESIS = Symbol('SPEECH_SYNTHESIS');

export interface SynthesizedSpeech {
  audio: Buffer; // WAV
  voice: string;
  engine: string;
}

export interface SpeechSynthesisPort {
  readonly engine: string; // Motor esperado → forma parte de la clave de caché (cambiar de motor = audios nuevos)
  synthesize(
    req: AudioRequest,
    accessToken: string,
  ): Promise<SynthesizedSpeech>;
}
