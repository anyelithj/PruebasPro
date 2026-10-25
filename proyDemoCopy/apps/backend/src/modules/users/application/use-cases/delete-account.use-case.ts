import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/interfaces/user.repository.interface';

@Injectable()
export class DeleteAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: IUserRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive)
      throw new ForbiddenException('Account already deactivated');
    await this.repo.deactivate(userId);
  }
}
