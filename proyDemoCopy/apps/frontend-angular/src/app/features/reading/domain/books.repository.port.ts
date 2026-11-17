import type { Observable } from 'rxjs';
import type { BookOpen, BookPosition, BookSearchResult, ChapterPage, SentenceIpa } from './models/book';
// [Port BooksRepository · Lectura → Libros · RF-145/146/147 · 2026-11-14]: la fachada no conoce HTTP | [Patrón]: Port (Hexagonal) | [Principio]: DIP

export abstract class BooksRepository {
  abstract search(q: { search?: string; language?: string; genre?: string; page: number }): Observable<BookSearchResult>;
  abstract open(id: number): Observable<BookOpen>; // Descarga el libro en el servidor la primera vez
  abstract page(id: number, chapter: number, page: number): Observable<ChapterPage>;
  abstract translate(id: number, chapter: number, paragraph: number): Observable<{ translation: string | null }>;
  abstract ipa(id: number, chapter: number, paragraph: number, sentence: number): Observable<SentenceIpa>;
  abstract progress(id: number): Observable<BookPosition | null>;
  abstract saveProgress(id: number, pos: BookPosition): Observable<BookPosition>;
}
