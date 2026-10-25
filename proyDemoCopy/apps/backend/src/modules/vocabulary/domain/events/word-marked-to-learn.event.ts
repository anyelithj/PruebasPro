// [Evento de dominio WordMarkedToLearn · Sprint 10.2 · RF-137]: el usuario pulsó «Aprender» en el diccionario → Games agrega la palabra al mazo de repetición espaciada sin que Vocabulary lo conozca | [Patrón]: Domain Event + Observer | [Principio]: OCP (suscriptores nuevos sin tocar el productor) | [Paradigma]: Event-Driven

export const WORD_MARKED_TO_LEARN_EVENT = 'vocabulary.word-marked-to-learn';

export class WordMarkedToLearnEvent {
  constructor(
    public readonly userId: string,
    public readonly entryId: string, // VocabularyEntry
  ) {}
}
