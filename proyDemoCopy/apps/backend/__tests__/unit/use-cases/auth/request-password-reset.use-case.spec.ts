import { createHash } from 'crypto';
import { RequestPasswordResetUseCase } from '../../../../src/modules/auth/application/use-cases/request-password-reset.use-case';

// [Suite RequestPasswordResetUseCase]: respuesta genérica, token hasheado en BD y enlace enviado por el Port de correo

describe('RequestPasswordResetUseCase', () => {
  let users: { findByEmail: jest.Mock };
  let tokens: { invalidateAllForUser: jest.Mock; create: jest.Mock };
  let mail: { send: jest.Mock };
  let useCase: RequestPasswordResetUseCase;

  beforeEach(() => {
    users = { findByEmail: jest.fn() };
    tokens = { invalidateAllForUser: jest.fn(), create: jest.fn() };
    mail = { send: jest.fn() };
    useCase = new RequestPasswordResetUseCase(
      users as any,
      tokens as any,
      mail,
    );
  });

  it('email desconocido → 200 sin token ni correo (no filtra existencia)', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute({ email: 'x@test.io' })).resolves.toEqual({
      success: true,
    });
    expect(tokens.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('usuario activo → guarda solo el hash y envía el enlace con el token en claro', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'ana@test.io',
      firstName: '<Ana>',
      isActive: true,
    });
    await useCase.execute({ email: 'ana@test.io' });

    const { to, text, html } = mail.send.mock.calls[0][0];
    const token = /token=([a-f0-9]{64})/.exec(text)![1];
    expect(to).toBe('ana@test.io');
    expect(tokens.create.mock.calls[0][0].tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(html).toContain('&lt;Ana&gt;'); // Nombre escapado en el HTML
  });

  it('fallo SMTP → sigue respondiendo 200', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'ana@test.io',
      firstName: 'Ana',
      isActive: true,
    });
    mail.send.mockRejectedValue(new Error('SMTP down'));
    await expect(useCase.execute({ email: 'ana@test.io' })).resolves.toEqual({
      success: true,
    });
  });
});
