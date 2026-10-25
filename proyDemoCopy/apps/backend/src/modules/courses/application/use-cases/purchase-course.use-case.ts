import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paymentsConfig } from '../../../../shared/config/payments.config';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../domain/interfaces/course.repository.interface';
// [UseCase PurchaseCourse]: registra la compra (pago) o la inscripción (gratis) de un curso → desbloquea su material | [Patrón]: Use Case (Command) | [Principio]: SRP + DIP | [Paradigma]: POO + async/await
// [Sprint 7.3]: con STRIPE_SECRET_KEY los cursos de pago SOLO se desbloquean con el webhook de Payments (403 aquí) · sin clave sigue la compra de demostración

@Injectable()
export class PurchaseCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY) private readonly repo: ICourseRepository,
  ) {}

  // `async` (ES2017): devuelve Promise | idempotente: una segunda compra conserva la fecha original
  async execute(
    userId: string,
    courseId: string,
  ): Promise<{ courseId: string; hasAccess: true; purchasedAt: string }> {
    const course = await this.repo.findById(courseId);
    if (!course || !course.isPublished)
      throw new NotFoundException(`Curso ${courseId} no encontrado`); // Borradores no se venden
    // [Seguridad]: sin este control cualquiera se saltaría el cobro llamando a este endpoint | `Number`: decimal de TypeORM llega como texto
    if (paymentsConfig().enabled && Number(course.price) > 0)
      throw new ForbiddenException(
        'Este curso se paga en el checkout (/checkout)',
      );
    const current = await this.repo.getEnrollment(userId, courseId);
    const purchasedAt = current?.purchasedAt ?? new Date(); // `??` (ES2020): no pisa una compra previa
    await this.repo.upsertEnrollment(userId, courseId, { purchasedAt });
    return {
      courseId,
      hasAccess: true,
      purchasedAt: purchasedAt.toISOString(),
    };
  }
}
