import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { VocabularyRepository } from '../domain/vocabulary.repository.port';
import type { Lookup, LookupInput } from '../domain/models/vocabulary';
// [IpaLookupCache · Aplicación · 2026-10-27]: consulta de IPA/traducción COMPARTIDA por todos los <aula-ipa-text> de la página | [Patrón]: Memoization + Request Coalescing (una promesa por texto) + Circuit Breaker + Bulkhead (cola con N peticiones en vuelo) | [Principio]: DRY + Fail Soft + software verde (menos peticiones) | [Paradigma]: async/await
// [Bug que corrige]: cada ficha tenía su propia fachada → una lección con 30 ejemplos lanzaba 30 POST /api/vocabulary/lookup a la vez y, con FastAPI/Ollama
// caído, la consola se llenaba de «503 (Service Unavailable)»; al volver a montar la ficha (React re-render) se repetía la tormenta
// [Comportamiento]: 1) mismo texto + idioma → misma promesa (en vuelo o resuelta) · 2) como mucho MAX_IN_FLIGHT a la vez · 3) un 503/504/0 abre el circuito
// COOLDOWN_MS: las fichas pendientes y las nuevas se quedan en texto plano sin pedir nada · 4) un 4xx (texto no admitido) se recuerda como «sin IPA» para ese texto
// [Registro]: en los providers de createApplication (elements.ts, junto a su puerto VocabularyRepository) → UNA instancia que comparten todas las etiquetas
// (no `providedIn: 'root'`: en la app Angular el repositorio se registra por ruta y un singleton raíz no lo encontraría)

const MAX_IN_FLIGHT = 3; // Peticiones simultáneas (el backend responde de caché casi siempre; el resto espera su turno)
const COOLDOWN_MS = 60_000; // Circuito abierto: 1 min sin llamar al servicio de idiomas
const MAX_ENTRIES = 500; // Tope de memoria (textos distintos por sesión)
// [Fallos transitorios]: dependencia caída o lenta (0 = sin conexión) → abren el circuito y NO se recuerdan por texto (se reintentan tras el enfriamiento)
const TRANSIENT = new Set([0, 429, 502, 503, 504]);

const keyOf = (i: LookupInput) => `${i.language}|${i.text.trim().toLowerCase()}`;

@Injectable()
export class IpaLookupCache {
  private readonly repo = inject(VocabularyRepository);
  private readonly results = new Map<string, Promise<Lookup | null>>(); // `Map` (ES2015): conserva el orden de inserción → expulsión FIFO
  private readonly queue: Array<() => void> = []; // Turnos en espera (Bulkhead)
  private inFlight = 0;
  private openUntil = 0; // Marca de tiempo hasta la que el circuito está abierto

  // [available]: false mientras el circuito está abierto (la UI no muestra «…» ni pide nada)
  available(): boolean {
    return Date.now() >= this.openUntil;
  }

  // [get]: nunca lanza → null = sin IPA (la ficha deja el texto plano) | `Promise<Lookup | null>`
  get(input: LookupInput): Promise<Lookup | null> {
    const key = keyOf(input);
    const hit = this.results.get(key);
    if (hit) return hit;
    if (!this.available()) return Promise.resolve(null);
    const pending = this.slot().then(async () => {
      try {
        if (!this.available()) {
          this.results.delete(key); // El circuito se abrió mientras esperaba turno → no se recuerda (se pedirá al cerrarse)
          return null;
        }
        return await firstValueFrom(this.repo.lookup(input));
      } catch (err: unknown) {
        // `ApiError` (errorInterceptor): status HTTP; otro error (p. ej. Zod por contrato roto) no es «servicio caído» → no abre el circuito
        if (err instanceof ApiError && TRANSIENT.has(err.status)) {
          this.openUntil = Date.now() + COOLDOWN_MS; // ANTES de liberar el turno → la siguiente de la cola ya ve el circuito abierto
          this.results.delete(key); // Transitorio → se podrá pedir otra vez al cerrarse el circuito
        }
        return null; // 4xx: se queda en caché como «sin IPA» (pedirlo otra vez daría el mismo error)
      } finally {
        this.release(); // `finally` (ES2018): libera el turno pase lo que pase
      }
    });
    this.remember(key, pending);
    return pending;
  }

  // [slot]: espera turno si ya hay MAX_IN_FLIGHT peticiones en curso
  private slot(): Promise<void> {
    if (this.inFlight < MAX_IN_FLIGHT) {
      this.inFlight += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve)).then(() => {
      this.inFlight += 1;
    });
  }

  private release(): void {
    this.inFlight -= 1;
    this.queue.shift()?.(); // `?.()` (ES2020): despierta al siguiente si lo hay
  }

  private remember(key: string, value: Promise<Lookup | null>): void {
    if (this.results.size >= MAX_ENTRIES) {
      const oldest = this.results.keys().next().value; // Iterador del Map: primera clave insertada
      if (oldest !== undefined) this.results.delete(oldest);
    }
    this.results.set(key, value);
  }
}
