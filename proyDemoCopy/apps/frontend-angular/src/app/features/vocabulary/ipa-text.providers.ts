import type { Provider } from '@angular/core';
import { IpaLookupCache } from './application/ipa-lookup.cache';
import { VocabularyRepository } from './domain/vocabulary.repository.port';
import { VocabularyHttpRepository } from './infrastructure/vocabulary.http-repository';
// [IPA_TEXT_PROVIDERS · 2026-10-28]: lo que necesita <aula-ipa-text-element> (IPA + traducción + sonido de cualquier texto) DENTRO de la app Angular — puerto del vocabulario → adaptador HTTP + caché/circuito compartido
// [Uso]: `providers: [...IPA_TEXT_PROVIDERS]` en las rutas de Práctica y Juegos (cada ruta lazy tiene su inyector; el Custom Element de Next.js los registra en elements.ts)
// [Patrón]: Composition Root reutilizable | [Principio]: DRY (una lista, varias rutas) + DIP (las pantallas dependen del puerto, no de HttpClient) | `Provider[]` (Angular): tipo de la lista de proveedores
export const IPA_TEXT_PROVIDERS: Provider[] = [
  { provide: VocabularyRepository, useClass: VocabularyHttpRepository },
  IpaLookupCache, // UNA instancia por ruta → textos repetidos (opciones, palabras del juego) no repiten la consulta
];
