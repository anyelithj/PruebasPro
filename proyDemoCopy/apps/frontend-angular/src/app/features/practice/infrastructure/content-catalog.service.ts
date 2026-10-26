import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, firstValueFrom, map, of, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import type { ActivityContent, ContentKind } from '../domain/models/practice';
// [ContentCatalogService · Infraestructura · 2026-10-23]: opciones para VINCULAR contenido a una actividad (vocabulario de Recursos, juegos, canciones, diálogos, fichas de gramática y temas de poliglota)
// [Patrón]: Adapter (cada listado de otro módulo → { label, href }) + Strategy (una consulta por tipo) | [Principio]: bajo acoplamiento (solo lee endpoints públicos; no importa otras features) + Fail-soft (sin opciones si un módulo falla)
// [Paradigma]: Reactivo (RxJS) + Funcional · [Seguridad]: los href son rutas internas del portal; los parámetros van codificados con HttpParams/URLSearchParams

// [Juegos]: rutas fijas del remoto (games.routes.ts) — no hay CRUD de juegos, se enlaza el modo de juego
const GAMES: ReadonlyArray<[string, string]> = [
  ['flashcards', 'Flashcards'],
  ['memory', 'Parejas'],
  ['bingo', 'Bingo de palabras'],
  ['clasificar', 'Clasificación rápida'],
  ['palabra-prohibida', 'Palabra prohibida'],
  ['tabu', 'Tabú'],
  ['20-preguntas', '20 preguntas'],
  ['describe-adivina', 'Describe y adivina'],
  ['historia', 'Historia encadenada'],
  ['debate', 'Debate rápido'],
];

// [Esquemas laxos]: solo los campos que se usan; `.passthrough()` no falla si el módulo añade campos
const Named = z.object({ id: z.string(), title: z.string(), slug: z.string().optional() }).passthrough();
const TopicGroup = z.object({ topic: z.string(), language: z.string(), level: z.string(), count: z.number().optional() });

export type ContentOption = Omit<ActivityContent, 'kind'>;

@Injectable({ providedIn: 'root' })
export class ContentCatalogService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  // [options]: opciones del tipo elegido para el idioma (y nivel) de la actividad | `firstValueFrom` (RxJS → Promise)
  options(kind: ContentKind, language: string, level: string): Promise<ContentOption[]> {
    return firstValueFrom(this.query(kind, language, level).pipe(catchError(() => of([]))));
  }

  private query(kind: ContentKind, language: string, level: string): Observable<ContentOption[]> {
    const params = new HttpParams().set('language', language);
    const list = (url: string, p?: HttpParams) => this.http.get<unknown>(url, { params: p }).pipe(map((r) => z.array(Named).parse(r)));
    switch (kind) {
      case 'vocabulary':
      case 'resource': {
        // Recursos publicados agrupados por tema → /resources/tema (vocabulario o cualquier tipo)
        const base = params.set('level', level).set('status', 'approved');
        const p = kind === 'vocabulary' ? base.set('kind', 'vocabulary') : base;
        return this.http.get<unknown>(`${this.api}/curriculum/by-topic`, { params: p }).pipe(
          map((r) => z.array(TopicGroup).parse(r)),
          map((gs) =>
            gs.map((g) => ({
              label: `${g.topic} · ${g.level}`,
              href: `/resources/tema?${new URLSearchParams({ topic: g.topic, language: g.language, level: g.level, ...(kind === 'vocabulary' ? { kind: 'vocabulary' } : {}) })}`,
            })),
          ),
        );
      }
      case 'game':
        return of(GAMES.map(([path, label]) => ({ label, href: `/juegos/${path}` })));
      case 'music':
        return list(`${this.api}/music/songs`, params).pipe(map((xs) => xs.map((s) => ({ label: s.title, href: `/musica/cancion/${encodeURIComponent(s.id)}` }))));
      case 'dialogue':
        return list(`${this.api}/dialogues`, params).pipe(map((xs) => xs.map((d) => ({ label: d.title, href: `/dialogos/${encodeURIComponent(d.id)}` }))));
      case 'grammar':
        return list(`${this.api}/grammar/topics`, params).pipe(map((xs) => xs.map((t) => ({ label: t.title, href: `/gramatica/${encodeURIComponent(t.id)}` }))));
      case 'polyglot':
        return list(`${this.api}/polyglot/topics`).pipe(map((xs) => xs.map((t) => ({ label: t.title, href: '/poliglota' }))));
      default:
        return of([]); // 'link': enlace escrito a mano
    }
  }
}
