// [DDD] entidad de proyecto del dominio — re-exporta el tipo Prisma como modelo de dominio
import { Project } from '@prisma/client';

export type ProjectModel = Project;
