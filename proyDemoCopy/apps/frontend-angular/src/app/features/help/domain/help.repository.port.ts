import type { Observable } from 'rxjs';
import type { AnsweredBy, Faq, FaqInput, GuideChunk, GuideQuestion, HelpLocale, ManualArticle, ManualEntry, ReindexResult } from './models/help';
// [Puerto HelpRepository · Dominio]: FAQ (pública + gestión ADMIN), manual por rol y Agente Guía (SSE, valoración, borrar conversación) | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP (las fachadas usan solo su parte)
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class HelpRepository {
  abstract faqs(locale: HelpLocale): Observable<Faq[]>;
  abstract createFaq(input: FaqInput): Observable<Faq>;
  abstract updateFaq(id: string, input: FaqInput): Observable<Faq>;
  abstract archiveFaq(id: string): Observable<void>;
  abstract manual(locale: HelpLocale): Observable<ManualEntry[]>;
  abstract article(slug: string, locale: HelpLocale): Observable<ManualArticle>;
  abstract reindex(): Observable<ReindexResult>;
  abstract ask(question: GuideQuestion): Observable<GuideChunk>;
  abstract rate(sessionId: string, messageIndex: number, helpful: boolean, answeredBy: AnsweredBy, route?: string): Observable<void>;
  abstract deleteConversation(sessionId: string): Observable<void>;
}
