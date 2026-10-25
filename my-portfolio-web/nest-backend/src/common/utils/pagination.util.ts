// [FP][DRY] cálculos de paginación puros
import { PageMeta, Paginated } from '../interfaces/paginated.interface';

export const offsetOf = (page: number, pageSize: number): number => (page - 1) * pageSize;

export const buildPageMeta = (page: number, pageSize: number, total: number): PageMeta => ({
  page,
  pageSize,
  total,
  totalPages: pageSize ? Math.ceil(total / pageSize) : 0,
});

export const paginate = <T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): Paginated<T> => ({ items, meta: buildPageMeta(page, pageSize, total) });
