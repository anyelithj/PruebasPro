// [DRY] Zod schema tipado
import { z } from 'zod';
import { RoleEnum } from 'src/common/enums/role.enum';

export const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(RoleEnum).default(RoleEnum.USER),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
