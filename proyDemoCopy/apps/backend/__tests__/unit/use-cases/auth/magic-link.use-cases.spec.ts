import { createHash } from 'node:crypto';
import { RequestMagicLinkUseCase } from '../../../../src/modules/auth/application/use-cases/request-magic-link.use-case';
import { VerifyMagicLinkUseCase } from '../../../../src/modules/auth/application/use-cases/verify-magic-link.use-case';
import {
  PURGE_RULES,
  PurgeExpiredSessionsUseCase,
} from '../../../../src/modules/scheduler/application/use-cases/purge-expired-sessions.use-case';
// [Suite MagicLink + purga · Sprints 1.5/7.18]: respuesta genérica, solo el hash en BD, canje de un solo uso que reutiliza la emisión del login y purga nocturna por tabla | [Patrón]: Test Double | [Herramienta]: Jest

const user = {
  id: 'u1',
  email: 'ana@aula.test',
  firstName: 'Ana',
  isActive: true,
  isEmailVerified: false,
};

function setup() {
  const rows: Array<Record<string, unknown>> = [];
  const tokens = {
    rows,
    create: jest.fn((x: object) => ({ id: 'm1', ...x })),
    save: jest.fn(async (x: Record<string, unknown>) => (rows.push(x), x)),
    findOneBy: jest.fn(
      async (w: { tokenHash: string }) =>
        rows.find((r) => r.tokenHash === w.tokenHash && !r.usedAt) ?? null,
    ),
    update: jest.fn(async (w: { id: string }) => {
      const r = rows.find((x) => x.id === w.id && !x.usedAt);
      if (r) r.usedAt = new Date();
      return { affected: r ? 1 : 0 };
    }),
  };
  const users = {
    findByEmail: jest.fn(async (e: string) => (e === user.email ? user : null)),
    findById: jest.fn(async () => user),
    update: jest.fn(async () => ({ ...user, isEmailVerified: true })),
  };
  const mail = { send: jest.fn(async () => undefined) };
  const login = {
    issue: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
  };
  return {
    tokens,
    users,
    mail,
    login,
    request: new RequestMagicLinkUseCase(
      users as never,
      tokens as never,
      mail as never,
    ),
    verify: new VerifyMagicLinkUseCase(
      tokens as never,
      users as never,
      login as never,
    ),
  };
}

describe('MagicLink', () => {
  it('correo desconocido: misma respuesta y ningún envío (anti-enumeración)', async () => {
    const s = setup();
    expect(await s.request.execute('nadie@aula.test')).toEqual({ sent: true });
    expect(s.mail.send).not.toHaveBeenCalled();
  });

  it('guarda solo el hash; el enlace se canjea UNA vez y verifica el correo', async () => {
    const s = setup();
    await s.request.execute(' Ana@Aula.test ');
    const [{ text }] = s.mail.send.mock.calls[0] as unknown as [
      { text: string },
    ];
    const token = /token=([0-9a-f]{64})/.exec(text)![1];
    expect(s.tokens.rows[0].tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(JSON.stringify(s.tokens.rows)).not.toContain(token);
    expect(await s.verify.execute(token)).toMatchObject({ accessToken: 'a' });
    expect(s.users.update).toHaveBeenCalledWith('u1', {
      isEmailVerified: true,
    });
    await expect(s.verify.execute(token)).rejects.toThrow(/no es válido/); // Segundo uso
    await expect(s.verify.execute('x')).rejects.toThrow(/no es válido/);
  });
});

describe('PurgeExpiredSessionsUseCase', () => {
  it('un DELETE por tabla y devuelve cuántas filas borró cada uno', async () => {
    const ds = { query: jest.fn(async () => [[], 2]) };
    const out = await new PurgeExpiredSessionsUseCase(ds as never).execute();
    expect(ds.query).toHaveBeenCalledTimes(PURGE_RULES.length);
    expect(out).toMatchObject({
      auth_sessions: 2,
      magic_link_tokens: 2,
      email_outbox: 2,
    });
  });
});
