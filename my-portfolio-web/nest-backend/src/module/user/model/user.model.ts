// [DDD] entidad de usuario del dominio — re-exporta el tipo Prisma como modelo de dominio
import { User } from '@prisma/client';

export type UserModel = User;
