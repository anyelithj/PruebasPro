import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/interfaces/user.repository.interface';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  section?: string | null;
  bio?: string | null; // [2026-10-23]: preferencias del perfil en BD
  phone?: string | null; // [2026-10-24]
  timezone?: string | null;
  preferredLanguage?: string | null;
}

export interface UpdateProfileResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  section: string | null;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: IUserRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UpdateProfileResult> {
    const existing = await this.repo.findById(userId);
    if (!existing) throw new NotFoundException('User not found');

    const partial: Record<string, unknown> = {};
    if (input.firstName !== undefined)
      partial.firstName = input.firstName.trim();
    if (input.lastName !== undefined) partial.lastName = input.lastName.trim();
    if (input.section !== undefined)
      partial.section = input.section?.trim() || null;
    // `for…of` (ES2015) sobre claves opcionales: "" → null (borrar), undefined → no tocar | [Principio]: DRY
    for (const key of ['bio', 'phone', 'timezone', 'preferredLanguage'] as const)
      if (input[key] !== undefined) partial[key] = input[key]?.trim() || null;

    const updated = await this.repo.update(userId, partial);
    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      section: updated.section ?? null,
    };
  }
}
