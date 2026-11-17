import { UnauthorizedException } from '@nestjs/common';
import {
  hashCode,
  IssueLoginOtpUseCase,
  MAX_OTP_ATTEMPTS,
} from '../../../../src/modules/auth/application/use-cases/issue-login-otp.use-case';
import { VerifyLoginOtpUseCase } from '../../../../src/modules/auth/application/use-cases/two-factor.use-cases';

// [Suite 2FA · 2026-11-16]: emisión del código por correo, canje de un solo uso y límite de intentos

describe('2FA por código OTP', () => {
  const user = {
    id: 'u1',
    email: 'a@test.io',
    firstName: 'Ana',
    isActive: true,
  };
  let otps: {
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOneBy: jest.Mock;
    increment: jest.Mock;
  };
  let mail: { send: jest.Mock };

  beforeEach(() => {
    otps = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest
        .fn()
        .mockImplementation((r) => Promise.resolve({ ...r, id: 'c1' })),
      create: jest.fn((r: Record<string, unknown>) => r),
      findOneBy: jest.fn(),
      increment: jest.fn(),
    };
    mail = { send: jest.fn() };
  });

  it('emite un código de 6 dígitos, guarda solo el hash y lo envía por correo', async () => {
    const res = await new IssueLoginOtpUseCase(otps as any, mail).execute(
      user as any,
    );
    expect(res).toEqual({ twoFactorRequired: true, challengeId: 'c1' });
    const sent = (mail.send.mock.calls as [{ text: string }][])[0][0];
    const saved = (otps.create.mock.calls as [{ codeHash: string }][])[0][0];
    const code = /(\d{6})/.exec(sent.text)![1];
    expect(saved.codeHash).toBe(hashCode('u1', code));
    expect(JSON.stringify(saved)).not.toContain(`"${code}"`);
  });

  const verify = (row: object | null) => {
    otps.findOneBy.mockResolvedValue(row);
    const users = { findById: jest.fn().mockResolvedValue(user) };
    const login = {
      issue: jest.fn().mockResolvedValue({ accessToken: 'acc' }),
    };
    return {
      uc: new VerifyLoginOtpUseCase(otps as any, users as any, login as any),
      login,
    };
  };
  const row = {
    id: 'c1',
    userId: 'u1',
    codeHash: hashCode('u1', '123456'),
    attempts: 0,
  };

  it('código correcto → emite la sesión y marca el reto como usado', async () => {
    const { uc, login } = verify(row);
    await expect(uc.execute('c1', '123456')).resolves.toEqual({
      accessToken: 'acc',
    });
    expect(login.issue).toHaveBeenCalledWith(user, undefined);
  });

  it('código erróneo → 401 y suma un intento', async () => {
    const { uc, login } = verify(row);
    await expect(uc.execute('c1', '000000')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(otps.increment).toHaveBeenCalledWith({ id: 'c1' }, 'attempts', 1);
    expect(login.issue).not.toHaveBeenCalled();
  });

  it('agotados los intentos ni el código correcto sirve', async () => {
    const { uc } = verify({ ...row, attempts: MAX_OTP_ATTEMPTS });
    await expect(uc.execute('c1', '123456')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('reto ya usado (carrera) → 401', async () => {
    const { uc } = verify(row);
    otps.update.mockResolvedValue({ affected: 0 });
    await expect(uc.execute('c1', '123456')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
