import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/interfaces/user.repository.interface';

export interface UserHistoryProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  section: string | null;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class GetUserHistoryUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: IUserRepository,
  ) {}

  async execute(userId: string): Promise<UserHistoryProfile> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      section: user.section ?? null,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
