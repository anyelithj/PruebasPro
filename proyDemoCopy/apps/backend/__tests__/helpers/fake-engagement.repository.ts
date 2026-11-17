import type {
  ICourseEngagementRepository,
  ReactionCounts,
  UserEngagement,
} from '../../src/modules/courses/domain/interfaces/course-engagement.repository.interface';
import type { CourseReactionType } from '../../src/modules/courses/domain/entities/course-reaction.entity';
// [Test helper · Caso F · 2026-11-13]: repositorio en memoria que cumple ICourseEngagementRepository → lo comparten las pruebas unitarias y de integración (DRY)
// [Patrón]: Test Double (Fake) + LSP (sustituye al adaptador PostgreSQL sin cambiar el caso de uso)

// [FakeEngagementRepo]: misma semántica que el adaptador PostgreSQL (PK por usuario+curso, upsert/delete idempotentes)
export class FakeEngagementRepo implements ICourseEngagementRepository {
  readonly favs = new Map<string, number>(); // clave «user|course» → orden de alta
  readonly reacts = new Map<string, CourseReactionType>();
  private seq = 0;
  private key = (u: string, c: string) => `${u}|${c}`;

  async setFavorite(u: string, c: string, on: boolean) {
    if (!on) this.favs.delete(this.key(u, c));
    else if (!this.favs.has(this.key(u, c))) this.favs.set(this.key(u, c), ++this.seq);
  }
  async setReaction(u: string, c: string, type: CourseReactionType | null) {
    if (type === null) this.reacts.delete(this.key(u, c));
    else this.reacts.set(this.key(u, c), type);
  }
  async engagementOf(u: string, ids: readonly string[]) {
    return new Map<string, UserEngagement>(ids.map((c) => [c, { favorite: this.favs.has(this.key(u, c)), reaction: this.reacts.get(this.key(u, c)) ?? null }]));
  }
  async countsOf(ids: readonly string[]) {
    const count = (c: string, t: CourseReactionType) => [...this.reacts].filter(([k, v]) => k.endsWith(`|${c}`) && v === t).length;
    return new Map<string, ReactionCounts>(ids.map((c) => [c, { likes: count(c, 'like'), loves: count(c, 'love') }]));
  }
  async favoriteIds(u: string, page: number, limit: number, kind: 'favorite' | CourseReactionType = 'favorite') {
    const mine =
      kind === 'favorite'
        ? [...this.favs].filter(([k]) => k.startsWith(`${u}|`)).sort((a, b) => b[1] - a[1]).map(([k]) => k.split('|')[1])
        : [...this.reacts].filter(([k, v]) => k.startsWith(`${u}|`) && v === kind).map(([k]) => k.split('|')[1]);
    return { ids: mine.slice((page - 1) * limit, page * limit), total: mine.length };
  }
}

