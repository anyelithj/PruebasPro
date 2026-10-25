// [DDD] entidad de envío de contacto — re-exporta el tipo Prisma como modelo de dominio
import { ContactSubmission, ContactStatus } from '@prisma/client';

export type ContactSubmissionModel = ContactSubmission;
export { ContactStatus };
