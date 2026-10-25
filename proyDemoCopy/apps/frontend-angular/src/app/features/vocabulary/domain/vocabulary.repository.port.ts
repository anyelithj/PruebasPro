import type { Observable } from 'rxjs';
import type {
  EntryFilter,
  EntryInput,
  EntryPatch,
  Lookup,
  LookupInput,
  VocabularyEntry,
} from './models/vocabulary';
// [Puerto VocabularyRepository · Dominio · Sprint 8.3]: traducir + IPA (con caché en NestJS) y CRUD del banco de vocabulario | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez (sin InjectionToken aparte)

export abstract class VocabularyRepository {
  abstract lookup(input: LookupInput): Observable<Lookup>;
  // [2026-10-23]: traducción libre entre dos idiomas (≤ 500 caracteres por llamada; el traductor trocea textos largos)
  abstract translate(text: string, source: string, target: string): Observable<string>;
  abstract getLookup(id: string): Observable<Lookup>;
  abstract list(filter: EntryFilter): Observable<VocabularyEntry[]>;
  abstract get(id: string): Observable<VocabularyEntry>;
  abstract create(input: EntryInput): Observable<VocabularyEntry>;
  abstract update(id: string, patch: EntryPatch): Observable<VocabularyEntry>;
  abstract remove(id: string): Observable<void>;
}
