// [DRY] setup de BD de pruebas reutilizable — fakes en memoria de los repositories.
// Vertical slice: los unit tests usan estos fakes (sin Postgres). La integración real
// contra Prisma se cubre en e2e con una DB de test.
import { SessionModel } from 'src/module/auth/model/session.model';
import { UserModel } from 'src/module/user/model/user.model';
import { UserRepository } from 'src/module/user/repository/user.repository';
import { AuthRepository } from 'src/module/auth/repository/auth.repository';
import { randomUUID } from 'crypto';

export class FakeUserRepository implements Partial<UserRepository> {
  private readonly rows = new Map<string, UserModel>();

  async findById(id: string): Promise<UserModel | null> {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    return [...this.rows.values()].find((u) => u.email === email) ?? null;
  }

  async listPaginated(offset: number, limit: number): Promise<[UserModel[], number]> {
    const all = [...this.rows.values()];
    return [all.slice(offset, offset + limit), all.length];
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role?: string;
  }): Promise<UserModel> {
    const now = new Date();
    const user = {
      id: randomUUID(),
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: (data.role ?? 'user') as UserModel['role'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as UserModel;
    this.rows.set(user.id, user);
    return user;
  }

  async update(id: string, data: Partial<UserModel>): Promise<UserModel> {
    const current = this.rows.get(id)!;
    const updated = { ...current, ...data, updatedAt: new Date() } as UserModel;
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

export class FakeAuthRepository implements Partial<AuthRepository> {
  private readonly sessions = new Map<string, SessionModel>();

  async createSession(data: {
    userId: string;
    refreshJti: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<SessionModel> {
    const row = {
      id: randomUUID(),
      userId: data.userId,
      refreshJti: data.refreshJti,
      expiresAt: data.expiresAt,
      revoked: false,
      userAgent: data.userAgent ?? null,
      createdAt: new Date(),
    } as SessionModel;
    this.sessions.set(data.refreshJti, row);
    return row;
  }

  async findActiveByJti(refreshJti: string): Promise<SessionModel | null> {
    const row = this.sessions.get(refreshJti);
    return row && !row.revoked ? row : null;
  }

  async revokeByJti(refreshJti: string): Promise<void> {
    const row = this.sessions.get(refreshJti);
    if (row) {
      row.revoked = true;
    }
  }
}
