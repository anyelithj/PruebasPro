import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import {
  CreateUserInput,
  IUserRepository,
  ListUsersOptions,
  PaginatedUsers,
} from '../../domain/interfaces/user.repository.interface';
// [Adapter TypeORM]: implementa el Port IUserRepository | [Patrón]: Repository + Adapter (Hexagonal) | [Principio]: DIP — Domain no depende de esta clase | [Paradigma]: POO

@Injectable()
export class UserRepository implements IUserRepository {
  // [Inyección via @InjectRepository]: TypeORM bridge a DI Nest | [Patrón]: Dependency Injection
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  // [findById]: lookup por PK | [Principio]: SRP
  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  // [findByEmail]: lookup case-sensitive (email ya normalizado en lower al guardar) | [Principio]: SRP
  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  // [create]: persiste tras hashing externo (responsabilidad del UseCase) | [Principio]: SRP
  async create(input: CreateUserInput): Promise<User> {
    // [create + save]: dos pasos para que cascade/relations funcionen correcto
    const entity = this.repo.create({
      ...input,
      email: input.email.toLowerCase().trim(),
    });
    return this.repo.save(entity);
  }

  // [update]: merge parcial atómico | [Principio]: SRP
  async update(id: string, partial: Partial<User>): Promise<User> {
    // [preload]: carga + merge sin perder campos no incluidos
    const merged = await this.repo.preload({ id, ...partial });
    if (!merged) throw new Error(`User ${id} not found for update`);
    return this.repo.save(merged);
  }

  // [deactivate]: flag soft, conserva historial | [Patrón]: Soft Delete
  async deactivate(id: string): Promise<void> {
    await this.repo.update({ id }, { isActive: false });
  }

  // [reactivate]: re-habilita usuario | [Principio]: SRP
  async reactivate(id: string): Promise<void> {
    await this.repo.update({ id }, { isActive: true });
  }

  // [listAll]: paginado + filtro role + búsqueda por nombre/email | [Patrón]: Specification | [Principio]: ISP
  async listAll(options: ListUsersOptions): Promise<PaginatedUsers> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (options.role) where.role = options.role;

    const qb = this.repo.createQueryBuilder('u');
    if (options.role) qb.andWhere('u.role = :role', { role: options.role });
    if (options.section) {
      qb.andWhere('u.section = :section', { section: options.section });
    }
    if (options.search) {
      qb.andWhere(
        '(u.email ILIKE :q OR u.firstName ILIKE :q OR u.lastName ILIKE :q)',
        { q: `%${options.search}%` },
      );
    }
    qb.orderBy('u.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // [countByRole]: agregado para reportes ADMIN | [Patrón]: Aggregate
  async countByRole(): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(u.id)', 'count')
      .groupBy('u.role')
      .getRawMany<{ role: string; count: string }>();
    const result: Record<string, number> = {};
    for (const r of rows) result[r.role] = parseInt(r.count, 10);
    return result;
  }

  // [listSections]: secciones distintas no nulas, ordenadas | [Patrón]: Distinct Query
  async listSections(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('u')
      .select('DISTINCT u.section', 'section')
      .where('u.section IS NOT NULL')
      .orderBy('u.section', 'ASC')
      .getRawMany<{ section: string }>();
    return rows.map((r) => r.section).filter(Boolean);
  }
}
