import type { Observable } from 'rxjs';
import type {
  Example,
  ExamplePatch,
  GrammarTopic,
  Section,
  SectionInput,
  TopicDetail,
  TopicFilter,
  TopicInput,
} from './models/grammar';
// [Puerto GrammarRepository · Dominio · Sprints 10.11/10.12]: fichas, secciones, ejemplos, borrador con IA e IPA/traducción | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP | [Paradigma]: POO
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class GrammarRepository {
  abstract listTopics(f: TopicFilter): Observable<GrammarTopic[]>;
  abstract getTopic(id: string): Observable<TopicDetail>;
  abstract createTopic(input: TopicInput): Observable<GrammarTopic>;
  abstract draft(input: TopicInput): Observable<{ id: string; sections: number; model: string }>;
  abstract updateTopic(id: string, patch: Partial<TopicInput> & { status?: GrammarTopic['status'] }): Observable<GrammarTopic>;
  abstract archiveTopic(id: string): Observable<void>;
  abstract enrich(id: string): Observable<{ updated: number }>;
  abstract addSection(topicId: string, input: SectionInput): Observable<Section>;
  abstract updateSection(id: string, patch: Partial<SectionInput>): Observable<Section>;
  abstract removeSection(id: string): Observable<void>;
  abstract addExample(sectionId: string, text: string): Observable<Example>;
  abstract updateExample(id: string, patch: ExamplePatch): Observable<Example>;
  abstract removeExample(id: string): Observable<void>;
}
