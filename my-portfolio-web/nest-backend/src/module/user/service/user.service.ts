// [SRP][OOP] lógica de usuarios — no toca HTTP, delega persistencia al repository
import { Injectable } from '@nestjs/common';
import { ConflictException } from 'src/common/exceptions/validation.exception';
import { NotFoundException } from 'src/common/exceptions/not-found.exception';
import { Paginated } from 'src/common/interfaces/paginated.interface';
import { hashPassword } from 'src/common/utils/hash.util';
import { buildPageMeta, offsetOf } from 'src/common/utils/pagination.util';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { toUserResponse, UserResponseDto } from '../dto/user-response.dto';
import { UserModel } from '../model/user.model';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    if (await this.repository.findByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.repository.create({
      name: dto.name,
      email: dto.email,
      passwordHash: await hashPassword(dto.password),
      role: dto.role,
    });
    return toUserResponse(user);
  }

  async getById(id: string): Promise<UserResponseDto> {
    return toUserResponse(await this.require(id));
  }

  async list(page: number, pageSize: number): Promise<Paginated<UserResponseDto>> {
    const [items, total] = await this.repository.listPaginated(offsetOf(page, pageSize), pageSize);
    return { items: items.map(toUserResponse), meta: buildPageMeta(page, pageSize, total) };
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.require(id);
    const user = await this.repository.update(id, dto);
    return toUserResponse(user);
  }

  async delete(id: string): Promise<void> {
    await this.require(id);
    await this.repository.delete(id);
  }

  private async require(id: string): Promise<UserModel> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
