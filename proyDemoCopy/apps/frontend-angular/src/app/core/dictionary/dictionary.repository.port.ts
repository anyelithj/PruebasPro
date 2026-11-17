import type { Observable } from 'rxjs';
import type { MarkedWord, MarkInput, WordLookup, WordQuery, WordStatus } from './dictionary.model';
// [Puerto DictionaryRepository · core · Sprint 10.3 · RF-136/RF-137]: consultar una palabra en su frase y marcarla «aprender» / «aprendido» | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP (core no conoce HttpClient) | [Paradigma]: POO
// `abstract class` (TS): contrato + token de inyección a la vez; el adaptador lo registra app.config (coreProviders) → también lo usan los Angular Elements

export abstract class DictionaryRepository {
  abstract lookup(q: WordQuery): Observable<WordLookup>;
  abstract ipa(q: Pick<WordQuery, 'language' | 'word'>): Observable<{ ipa: string | null; ipa_us: string | null }>; // [2026-10-31]: sin LLM → al instante
  // [translate · 2026-11-09]: frase completa (títulos de varias palabras); opcional → los dobles de prueba no lo necesitan
  translate?(text: string, source: string, target: string): Observable<{ translation: string }>;
  abstract listMarked(language: string): Observable<MarkedWord[]>;
  abstract mark(input: MarkInput): Observable<MarkedWord>;
  abstract setStatus(id: string, status: WordStatus): Observable<MarkedWord>;
  abstract unmark(id: string): Observable<void>;
}
