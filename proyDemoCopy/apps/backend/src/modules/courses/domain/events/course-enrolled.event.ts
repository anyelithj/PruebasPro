// [Domain Event]: emitido cuando un usuario se inscribe a un curso | [Patrón]: Domain Event (DDD) + Observer | [Principio]: OCP

export class CourseEnrolledEvent {
  static readonly NAME = 'course.enrolled';

  constructor(
    public readonly userId: string,
    public readonly courseId: string,
    public readonly enrolledAt: Date = new Date(),
  ) {}
}
