import { ConflictException } from '@nestjs/common';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { titleKey } from '../domain/title-key';
import { LANGUAGE_LABEL, type Language } from '../domain/language.vo';
// [Regla anti-duplicados · 2026-10-28]: ningún recurso/actividad/examen/curso se repite con el MISMO título (normalizado) dentro de su ámbito (idioma + nivel + tipo)
// [Patrón]: Specification (ámbito = `where`) + Guard Clause (409 antes de guardar) | [Principio]: DRY (un único helper para todos los módulos) + SRP + Fail Fast | [Paradigma]: Funcional + async/await
// [Por qué en JS y no solo en SQL]: la normalización Unicode completa (NFD + \p{M}) no es IMMUTABLE en PostgreSQL → la BD tiene un índice más conservador (migración TitleDedup) como red de seguridad ante carreras

// [DuplicateScope]: lo que describe el registro en el mensaje (p. ej. «una canción», «francés A1») | `?` (TS): opcionales
export interface DuplicateScope {
  label: string; // Sustantivo con artículo indefinido: «una canción», «un diálogo»…
  language?: string | null; // Código ISO → nombre en español en el mensaje
  level?: string | null;
  extra?: string; // Matiz del ámbito (p. ej. «del juego Parejas»)
}

// [scopeText]: « para francés A1» | '' si no hay idioma ni nivel | Función pura
const scopeText = (s: DuplicateScope): string => {
  const lang = s.language
    ? (LANGUAGE_LABEL[s.language as Language] ?? s.language).toLowerCase()
    : '';
  const parts = [lang, s.level ?? ''].filter(Boolean).join(' ');
  return `${s.extra ? ` ${s.extra}` : ''}${parts ? ` para ${parts}` : ''}`;
};

// [duplicateTitleError]: 409 con mensaje accionable en español | exportada → la reutiliza el filtro global ante el índice único (carreras)
export const duplicateTitleError = (
  existingTitle: string,
  scope: DuplicateScope,
): ConflictException =>
  new ConflictException({
    message: `Ya existe ${scope.label} con el título «${existingTitle}»${scopeText(scope)}. Cambia el título o edita el registro existente.`,
    code: 'DUPLICATE_TITLE', // [Contrato]: código estable → el frontend puede distinguirlo sin parsear el texto
  });

// [firstDuplicate]: entre candidatos ya cargados, el primero con la misma clave normalizada (sin contar `excludeId`) | Función pura → la usan también los módulos con repositorio propio (Cursos)
export const firstDuplicate = <T extends { id: string; title: string }>(
  candidates: readonly T[],
  title: string,
  excludeId?: string,
): T | null => {
  const key = titleKey(title);
  if (!key) return null; // Título vacío: lo rechaza la validación del DTO, no esta regla
  return candidates.find((c) => c.id !== excludeId && titleKey(c.title) === key) ?? null;
};

// [findDuplicateTitle]: candidatos del ámbito (consulta parametrizada de TypeORM, solo id + título) → el primero con la misma clave normalizada | null si no hay
// `excludeId`: en una edición el propio registro no cuenta | `where` lo arma cada módulo (idioma, nivel, tipo, sin archivados)
export async function findDuplicateTitle<
  T extends { id: string; title: string },
>(
  repo: Repository<T>,
  title: string,
  where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  excludeId?: string,
): Promise<T | null> {
  if (!titleKey(title)) return null; // Sin consulta si no hay nada que comparar
  // `select` tipado como never: TypeORM no infiere FindOptionsSelect sobre un genérico | lectura ligera (sin jsonb ni relaciones)
  const candidates = await repo.find({
    where,
    select: { id: true, title: true } as never,
  });
  return firstDuplicate(candidates, title, excludeId);
}

// [assertUniqueTitle]: guard que lanza el 409 | uso: `await assertUniqueTitle(repo, dto.title, { language, level, archivedAt: IsNull() }, { label: 'una canción', language, level })`
export async function assertUniqueTitle<
  T extends { id: string; title: string },
>(
  repo: Repository<T>,
  title: string,
  where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  scope: DuplicateScope,
  excludeId?: string,
): Promise<void> {
  const dup = await findDuplicateTitle(repo, title, where, excludeId);
  if (dup) throw duplicateTitleError(dup.title, scope);
}
