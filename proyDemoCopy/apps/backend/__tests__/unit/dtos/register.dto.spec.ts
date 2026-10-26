import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../../../src/modules/auth/application/dtos/register.dto';

// [Suite RegisterDto · 2026-10-24]: el teléfono es opcional y usa la regla única de `@OptionalPhone` (phone.vo.ts) | [Patrón]: Table-driven tests (`it.each`)

describe('RegisterDto · phone', () => {
  const base = {
    email: 'ana@test.io',
    password: 'StrongP@ss123',
    firstName: 'Ana',
    lastName: 'López',
  };

  // [Helper]: errores SOLO del campo phone | `plainToInstance` (class-transformer): JSON → instancia con metadatos de decoradores
  const phoneErrors = async (phone: unknown) => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...base, phone }),
    );
    return errors.filter((e) => e.property === 'phone');
  };

  it('acepta el alta sin teléfono', async () => {
    expect(await validate(plainToInstance(RegisterDto, base))).toHaveLength(0);
  });

  it.each(['+57 300 123 4567', '3001234567', '(601) 555-1234', ''])(
    'acepta %p',
    async (phone) => {
      expect(await phoneErrors(phone)).toHaveLength(0);
    },
  );

  it.each(['abc1234567', '12345', '+57 300 123 4567 999 999 9', 12345])(
    'rechaza %p',
    async (phone) => {
      expect(await phoneErrors(phone)).toHaveLength(1);
    },
  );
});
