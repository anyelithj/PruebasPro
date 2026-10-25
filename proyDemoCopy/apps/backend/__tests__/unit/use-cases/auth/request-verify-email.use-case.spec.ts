import { createHash } from 'crypto';
import { RequestVerifyEmailUseCase } from '../../../../src/modules/auth/application/use-cases/request-verify-email.use-case';

// [Suite RequestVerifyEmailUseCase]: respuesta genérica, token hasheado en BD y enlace enviado por el Port de correo (RF-09)

describe('RequestVerifyEmailUseCase', () => {
  let users: { findByEmail: jest.Mock };
  let tokens: { invalidateAllForUser: jest.Mock; create: jest.Mock };
  let mail: { send: jest.Mock };
  let useCase: RequestVerifyEmailUseCase;
  const ana = {
    id: 'u1',
    email: 'ana@test.io',
    firstName: '<Ana>',
    isActive: true,
    isEmailVerified: false,
  };

  beforeEach(() => {
    users = { findByEmail: jest.fn() };
    tokens = { invalidateAllForUser: jest.fn(), create: jest.fn() };
    mail = { send: jest.fn() };
    useCase = new RequestVerifyEmailUseCase(users as any, tokens as any, mail);
  });

  it('email desconocido o ya verificado → 200 sin token ni correo', async () => {
    users.findByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...ana, isEmailVerified: true });
    await expect(useCase.execute({ email: 'x@test.io' })).resolves.toEqual({
      success: true,
    });
    await expect(useCase.execute({ email: 'ana@test.io' })).resolves.toEqual({
      success: true,
    });
    expect(tokens.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('usuario sin verificar → guarda solo el hash y envía el enlace /verify-email con el token en claro', async () => {
    users.findByEmail.mockResolvedValue(ana);
    await useCase.execute({ email: 'ana@test.io' });

    const { to, text, html } = mail.send.mock.calls[0][0];
    const token = /verify-email\?token=([a-f0-9]{64})/.exec(text)![1];
    expect(to).toBe('ana@test.io');
    expect(tokens.invalidateAllForUser).toHaveBeenCalledWith('u1'); // el enlace anterior deja de servir
    expect(tokens.create.mock.calls[0][0].tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(html).toContain('&lt;Ana&gt;'); // Nombre escapado en el HTML
  });

  it('fallo SMTP → sigue respondiendo 200', async () => {
    users.findByEmail.mockResolvedValue(ana);
    mail.send.mockRejectedValue(new Error('SMTP down'));
    await expect(useCase.execute({ email: 'ana@test.io' })).resolves.toEqual({
      success: true,
    });
  });
});
