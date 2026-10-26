import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm'; // [TypeORM]: consulta de lectura agregada (read model) sin acoplar Users a las entidades de Courses/Certificates
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/interfaces/user.repository.interface';
// [Use Case GetProfile]: perfil propio + estadísticas de aprendizaje (cursos inscritos y nivel MCER) | [Patrón]: Query (CQRS-lite) + Read Model | [Principio]: SRP + DIP

export interface PublicProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  section: string | null;
  bio: string | null; // [2026-10-23]: preferencias en BD (antes localStorage)
  phone: string | null; // [2026-10-24]
  timezone: string | null;
  preferredLanguage: string | null;
  enrolledCourses: number; // Cursos con acceso (purchased_at no nulo = inscrito o comprado)
  level: string | null; // Nivel MCER: mayor certificado obtenido, si no el mayor nivel de los cursos inscritos
  isActive: boolean;
  createdAt: Date;
}

// `const` + regex (JS): solo niveles MCER válidos (los cursos legacy tienen categorías no MCER) | [Principio]: SSOT del formato
const CEFR = /^[ABC][12]$/;

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: IUserRepository,
    private readonly db: DataSource, // [DI NestJS]: DataSource global de TypeOrmModule
  ) {}

  async execute(userId: string): Promise<PublicProfile> {
    // `Promise.all` (ES2015): usuario y estadísticas en paralelo | [Rendimiento]
    const [user, stats] = await Promise.all([
      this.repo.findById(userId),
      this.stats(userId),
    ]);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      section: user.section ?? null,
      bio: user.bio ?? null,
      phone: user.phone ?? null,
      timezone: user.timezone ?? null,
      preferredLanguage: user.preferredLanguage ?? null,
      ...stats, // `...` spread (ES2018): enrolledCourses + level
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  // [stats]: una sola ida a PostgreSQL | `max()` sobre 'A1'..'C2' funciona porque el orden alfabético coincide con el MCER | [Paradigma]: Declarativo (SQL)
  private async stats(
    userId: string,
  ): Promise<Pick<PublicProfile, 'enrolledCourses' | 'level'>> {
    const [row] = await this.db.query<
      { enrolled: string; cert: string | null; course: string | null }[]
    >(
      `SELECT
         (SELECT count(*) FROM course_enrollments e WHERE e.user_id = $1 AND e.purchased_at IS NOT NULL) AS enrolled,
         (SELECT max(c.cefr_level) FROM certificates c WHERE c.user_id = $1 AND c.status = 'issued') AS cert,
         (SELECT max(co.category::text) FROM course_enrollments e JOIN courses co ON co.id = e.course_id
            WHERE e.user_id = $1 AND e.purchased_at IS NOT NULL AND co.category::text ~ '^[ABC][12]$') AS course`,
      [userId], // [Seguridad]: parámetro posicional → sin inyección SQL
    );
    const level = [row?.cert, row?.course].find((l) => l && CEFR.test(l)); // `find` (ES2015): el certificado manda sobre el curso
    return {
      enrolledCourses: Number(row?.enrolled ?? 0),
      level: level ?? null,
    };
  }
}
