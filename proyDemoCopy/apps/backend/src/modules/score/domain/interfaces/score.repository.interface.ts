import { Score } from '../entities/score.entity';
// [Port score repo] | [Patron]: Repository + Port (Hexagonal) | [Principio]: DIP + ISP

export const SCORE_REPOSITORY = Symbol('SCORE_REPOSITORY');

export interface CreateScoreInput {
  userId: string;
  quizId: string;
  sessionId: string;
  points: number;
  correctCount: number;
  totalQuestions: number;
}

export interface LeaderboardEntry {
  userId: string;
  // [Nombre legible]: derivado de users.first_name + last_name vía join | [Principio]: SSOT
  displayName: string;
  totalPoints: number;
  quizzesCompleted: number;
  avgAccuracy: number;
}

export interface IScoreRepository {
  create(input: CreateScoreInput): Promise<Score>;
  // [since]: fecha de corte opcional — solo scores con createdAt >= since | [Patrón]: Time Window
  findByUser(userId: string, limit?: number, since?: Date): Promise<Score[]>;
  // [since + section]: ventana temporal y filtro por sección de estudiante (join users) | [Patrón]: Time Window + Scoped Filter
  getLeaderboard(
    limit?: number,
    since?: Date,
    section?: string,
  ): Promise<LeaderboardEntry[]>;
  countByUser(userId: string): Promise<number>;
  sumPointsByUser(userId: string): Promise<number>;
}
