import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DictionaryRepository } from './dictionary.repository.port';
import {
  termKey,
  WordQuerySchema,
  type MarkedWord,
  type WordLookup,
  type WordStatus,
} from './dictionary.model';
// [DictionaryFacade · core · Sprint 10.3 · RF-136/RF-137]: casos de uso del diccionario al pulsar una palabra — consultar (con caché en memoria además de la de NestJS), cargar las palabras marcadas de un idioma y «Aprender» / «Aprendido» / quitar marca | [Patrón]: Facade + Memoization + Optimistic UI | [Principio]: SRP + DIP + DRY (una instancia para toda la app: cualquier texto comparte caché y marcas) | [Paradigma]: Reactivo (signals) + async/await

@Injectable({ providedIn: 'root' })
export class DictionaryFacade {
  private readonly repo = inject(DictionaryRepository);
  // `Map` (ES2015): «idioma|palabra|frase» → consulta en curso o resuelta (dos clics seguidos no repiten la petición)
  private readonly cache = new Map<string, Promise<WordLookup | null>>();
  private readonly loadedLanguages = new Set<string>();
  // [marked]: termKey → palabra marcada, por idioma → el texto resalta las que se están aprendiendo
  readonly marked = signal<Record<string, Record<string, MarkedWord>>>({});
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  // [lookup]: null si la palabra no es válida o la consulta falló (la ventana muestra el error y deja reintentar)
  lookup(language: string, word: string, sentence = ''): Promise<WordLookup | null> {
    const parsed = WordQuerySchema.safeParse({ language, word, sentence: sentence.slice(0, 400) });
    if (!parsed.success) return Promise.resolve(null);
    const key = `${language}|${termKey(word)}|${sentence}`;
    let hit = this.cache.get(key);
    if (!hit) {
      hit = firstValueFrom(this.repo.lookup(parsed.data)).catch(() => {
        this.cache.delete(key); // Un fallo no queda en caché: el siguiente clic reintenta
        return null;
      });
      this.cache.set(key, hit);
    }
    return hit;
  }

  // [loadMarked]: una vez por idioma y sesión (el resaltado no vuelve a pedirse en cada texto)
  async loadMarked(language: string): Promise<void> {
    if (this.loadedLanguages.has(language)) return;
    this.loadedLanguages.add(language);
    try {
      const list = await firstValueFrom(this.repo.listMarked(language));
      this.marked.update((m) => ({
        ...m,
        [language]: Object.fromEntries(list.map((w) => [w.termKey ?? termKey(w.term), w])),
      }));
    } catch {
      this.loadedLanguages.delete(language); // Sin sesión o sin red: sin resaltado (no es un error para el usuario)
    }
  }

  statusOf(language: string, word: string): MarkedWord | null {
    return this.marked()[language]?.[termKey(word)] ?? null;
  }

  async markToLearn(language: string, word: string, lookup?: WordLookup | null, sentence?: string): Promise<boolean> {
    return this.act(language, word, () =>
      this.repo.mark({
        language,
        word,
        translation: lookup?.result.translation || undefined,
        sentence: sentence || undefined,
      }),
    );
  }

  async setStatus(language: string, word: string, status: WordStatus): Promise<boolean> {
    const current = this.statusOf(language, word);
    if (!current) return false;
    return this.act(language, word, () => this.repo.setStatus(current.id, status));
  }

  async unmark(language: string, word: string): Promise<boolean> {
    const current = this.statusOf(language, word);
    if (!current) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.repo.unmark(current.id));
      const key = termKey(word);
      this.marked.update((m) => ({
        ...m,
        [language]: Object.fromEntries(Object.entries(m[language] ?? {}).filter(([k]) => k !== key)),
      }));
      return true;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  // [act]: guarda la palabra devuelta por NestJS en el mapa del idioma → todos los textos de la página se repintan a la vez
  private async act(
    language: string,
    word: string,
    run: () => ReturnType<DictionaryRepository['mark']>,
  ): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const saved = await firstValueFrom(run());
      this.marked.update((m) => ({
        ...m,
        [language]: { ...(m[language] ?? {}), [termKey(word)]: saved },
      }));
      return true;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
