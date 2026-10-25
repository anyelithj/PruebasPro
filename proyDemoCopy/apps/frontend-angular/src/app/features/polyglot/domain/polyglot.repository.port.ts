import type { Observable } from 'rxjs';
import type {
  ComparisonTable,
  Concept,
  ConceptDetail,
  ConceptInput,
  Term,
  TermInput,
  Topic,
  TopicInput,
  View,
} from './models/polyglot';
// [Puerto PolyglotRepository · Dominio · Sprints 10.7/10.8]: temas, tabla comparativa, conceptos, términos, vistas guardadas y borrador con IA | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP | [Paradigma]: POO
// `abstract class` (TS): contrato + token de inyección a la vez (sin InjectionToken aparte)

export abstract class PolyglotRepository {
  abstract listTopics(): Observable<Topic[]>;
  abstract getTopic(id: string): Observable<Topic>;
  abstract createTopic(input: TopicInput): Observable<Topic>;
  abstract updateTopic(id: string, patch: Partial<TopicInput> & { status?: Topic['status'] }): Observable<Topic>;
  abstract archiveTopic(id: string): Observable<void>;
  abstract draft(topicId: string, body: { kind: 'word' | 'phrase'; count: number }): Observable<{ added: number; model: string }>;
  abstract enrich(topicId: string): Observable<{ updated: number; failed: number }>;
  abstract table(topicId: string, languages: readonly string[]): Observable<ComparisonTable>;
  abstract getConcept(id: string): Observable<ConceptDetail>;
  abstract addConcept(topicId: string, input: ConceptInput): Observable<Concept>;
  abstract updateConcept(id: string, patch: Partial<ConceptInput>): Observable<Concept>;
  abstract removeConcept(id: string): Observable<void>;
  abstract upsertTerms(conceptId: string, terms: TermInput[]): Observable<Term[]>;
  abstract reviewTerm(id: string, patch: { text?: string; ipa?: string; ipaUs?: string }): Observable<Term>;
  abstract removeTerm(id: string): Observable<void>;
  abstract listViews(): Observable<View[]>;
  abstract saveView(body: { topicId: string; name?: string; languages: readonly string[] }): Observable<View>;
  abstract updateView(id: string, patch: { name?: string; languages?: readonly string[] }): Observable<View>;
  abstract deleteView(id: string): Observable<void>;
}
