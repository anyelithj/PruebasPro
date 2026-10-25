import type { Observable } from 'rxjs';
import type { SseData, SseMessage } from '@shared/utils/event-source';
import type {
  Dialogue,
  DialogueDetail,
  DialogueDraft,
  DialogueFilter,
  DialogueInput,
  Session,
  SessionDetail,
  StartResult,
  Topic,
  TopicInput,
  DraftRequest,
  TurnResult,
  Turn,
} from './models/dialogues';
// [Puerto DialoguesRepository · Dominio · Sprints 9.11–9.13]: temas, biblioteca, subida con nivel, audio, conversación con el avatar (JSON y SSE) y transcripción de voz | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez (sin InjectionToken aparte)

export abstract class DialoguesRepository {
  abstract listTopics(filter: { language?: string; level?: string }): Observable<Topic[]>;
  abstract createTopic(input: TopicInput): Observable<Topic>;
  abstract listDialogues(filter: DialogueFilter): Observable<Dialogue[]>;
  abstract getDialogue(id: string): Observable<DialogueDetail>;
  abstract createDialogue(input: DialogueInput): Observable<Dialogue>;
  abstract readUrl(url: string): Observable<{ title: string; text: string; holder: string }>; // [2026-10-19]: texto de la página (BFF Next.js, anti-SSRF)
  abstract draftDialogue(req: DraftRequest): Observable<DialogueDraft>; // [2026-10-19]: guion leído o generado por la IA (no guarda)
  abstract uploadAudio(id: string, file: Blob): Observable<{ aligned: boolean }>;
  abstract audioUrl(id: string): string;
  abstract confirmLevel(id: string, level: string): Observable<Dialogue>;
  abstract withdraw(id: string): Observable<void>;
  abstract startSession(input: {
    topicId: string;
    language: string;
    level: string;
  }): Observable<StartResult>;
  abstract listSessions(): Observable<Session[]>;
  abstract getSession(id: string): Observable<SessionDetail>;
  abstract sendTurn(id: string, text: string): Observable<TurnResult>;
  abstract streamTurn(id: string, text: string): Observable<SseMessage<SseData>>;
  abstract endSession(id: string): Observable<Session>;
  abstract deleteSession(id: string): Observable<void>;
  abstract transcribe(audio: Blob, language: string): Observable<string>;
  abstract saveRecording(sessionId: string, turnId: string, audio: Blob): Observable<Turn>; // [2026-10-20]: guarda la voz del turno
  abstract recordingUrl(sessionId: string, turnId: string): string;
}
