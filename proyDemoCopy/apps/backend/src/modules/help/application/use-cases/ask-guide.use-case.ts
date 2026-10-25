import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import {
  AssistantClientService,
  type ChatResult,
  type GuideInput,
} from '../../../ai/assistant-client.service';
// [UseCase AskGuide · Sprint 7.10 · RF-96]: pregunta al Agente Guía (persona «guide» de FastAPI) con la pantalla y el idioma de la interfaz | [Patrón]: Use Case + Proxy (JSON y SSE) | [Principio]: SRP + DIP + DRY (el mismo AssistantClientService del tutor) | [Paradigma]: POO + async/await
// [Seguridad]: el rol NO viaja en el cuerpo — FastAPI lo lee del mismo JWT → nadie pide el manual de ADMIN fingiendo serlo · límite de peticiones en el controlador

@Injectable()
export class AskGuideUseCase {
  constructor(private readonly assistant: AssistantClientService) {}

  execute(input: GuideInput, token: string): Promise<ChatResult> {
    return this.assistant.guide(input, token);
  }

  // [stream]: eventos session → token… → sources → done (el controlador los canaliza sin buffer)
  stream(
    input: GuideInput,
    token: string,
    signal: AbortSignal,
  ): Promise<Readable> {
    return this.assistant.guideStream(input, token, signal);
  }
}
