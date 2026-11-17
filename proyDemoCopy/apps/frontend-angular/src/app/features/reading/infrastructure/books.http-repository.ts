import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { BooksRepository } from '../domain/books.repository.port';
import {
  BookOpenSchema,
  BookPositionSchema,
  BookSearchResultSchema,
  ChapterPageSchema,
  type BookOpen,
  type BookPosition,
  type BookSearchResult,
  type ChapterPage,
  type SentenceIpa,
} from '../domain/models/book';
// [Adapter BooksHttpRepository · Lectura → Libros · 2026-11-14]: BooksRepository sobre NestJS /books (respuestas validadas con Zod) | [Patrón]: Adapter

@Injectable()
export class BooksHttpRepository extends BooksRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/books`;

  search(q: { search?: string; language?: string; genre?: string; page: number }): Observable<BookSearchResult> {
    let params = new HttpParams().set('page', q.page);
    if (q.search) params = params.set('search', q.search);
    if (q.language) params = params.set('language', q.language);
    if (q.genre) params = params.set('genre', q.genre);
    return this.http.get<unknown>(this.base, { params }).pipe(map((r) => BookSearchResultSchema.parse(r)));
  }

  open(id: number): Observable<BookOpen> {
    return this.http.get<unknown>(`${this.base}/${id}/chapters`).pipe(map((r) => BookOpenSchema.parse(r)));
  }

  page(id: number, chapter: number, page: number): Observable<ChapterPage> {
    return this.http
      .get<unknown>(`${this.base}/${id}/chapters/${chapter}`, { params: new HttpParams().set('page', page) })
      .pipe(map((r) => ChapterPageSchema.parse(r)));
  }

  translate(id: number, chapter: number, paragraph: number): Observable<{ translation: string | null }> {
    return this.http
      .post<unknown>(`${this.base}/${id}/chapters/${chapter}/paragraphs/${paragraph}/translation`, {})
      .pipe(map((r) => z.object({ translation: z.string().nullable() }).parse(r)));
  }

  ipa(id: number, chapter: number, paragraph: number, sentence: number): Observable<SentenceIpa> {
    return this.http
      .get<unknown>(`${this.base}/${id}/chapters/${chapter}/paragraphs/${paragraph}/sentences/${sentence}/ipa`)
      .pipe(map((r) => z.object({ ipa: z.string(), ipa_us: z.string().nullable(), parts: z.array(z.object({ text: z.string(), ipa: z.string() })).default([]) }).parse(r)));
  }

  progress(id: number): Observable<BookPosition | null> {
    return this.http.get<unknown>(`${this.base}/${id}/progress`).pipe(map((r) => BookPositionSchema.nullable().parse(r ?? null)));
  }

  saveProgress(id: number, pos: BookPosition): Observable<BookPosition> {
    return this.http.put<unknown>(`${this.base}/${id}/progress`, pos).pipe(map((r) => BookPositionSchema.parse(r)));
  }
}
