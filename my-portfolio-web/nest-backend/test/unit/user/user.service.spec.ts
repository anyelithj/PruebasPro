// [TDD][SRP] prueba UserService con UserRepository fake
import { UserService } from 'src/module/user/service/user.service';
import { UserRepository } from 'src/module/user/repository/user.repository';
import { ConflictException } from 'src/common/exceptions/validation.exception';
import { NotFoundException } from 'src/common/exceptions/not-found.exception';
import { FakeUserRepository } from '../../helpers/test-database.helper';

function makeService() {
  const repo = new FakeUserRepository() as unknown as UserRepository;
  return new UserService(repo);
}

describe('UserService', () => {
  it('creates and fetches a user without leaking passwordHash', async () => {
    const service = makeService();
    const created = await service.create({
      name: 'Ana',
      email: 'ana@test.dev',
      password: 'supersecret',
      role: 'user' as never,
    });
    expect(created).not.toHaveProperty('passwordHash');

    const fetched = await service.getById(created.id);
    expect(fetched.email).toBe('ana@test.dev');
  });

  it('rejects duplicate email', async () => {
    const service = makeService();
    await service.create({
      name: 'Ana',
      email: 'dup@test.dev',
      password: 'supersecret',
      role: 'user' as never,
    });
    await expect(
      service.create({
        name: 'Bob',
        email: 'dup@test.dev',
        password: 'supersecret',
        role: 'user' as never,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFound for missing user', async () => {
    const service = makeService();
    await expect(service.getById('missing-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('paginates', async () => {
    const service = makeService();
    for (let i = 0; i < 3; i++) {
      await service.create({
        name: `U${i}`,
        email: `u${i}@test.dev`,
        password: 'supersecret',
        role: 'user' as never,
      });
    }
    const page = await service.list(1, 2);
    expect(page.items).toHaveLength(2);
    expect(page.meta.total).toBe(3);
    expect(page.meta.totalPages).toBe(2);
  });
});
