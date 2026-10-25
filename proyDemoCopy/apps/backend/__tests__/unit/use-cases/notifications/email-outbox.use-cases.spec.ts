import type { Job } from 'bull';
import { EnqueueEmailUseCase } from '../../../../src/modules/notifications/application/use-cases/enqueue-email.use-case';
import { RetryEmailUseCase } from '../../../../src/modules/notifications/application/use-cases/retry-email.use-case';
import type { EmailOutbox } from '../../../../src/modules/notifications/domain/entities/email-outbox.entity';
import { EmailProcessor } from '../../../../src/modules/notifications/infrastructure/queue/email.processor';
// [Suite EmailOutbox · Sprint 7.15 · RF-63]: guardar antes de enviar, envío idempotente, reintento con backoff hasta «failed» y reintento manual | [Patrón]: Test Double (repositorio, cola y SMTP en memoria) | [Herramienta]: Jest

function setup() {
  const rows: EmailOutbox[] = [];
  const outbox = {
    rows,
    create: jest.fn(
      (x: Partial<EmailOutbox>) =>
        ({ id: `e${rows.length + 1}`, ...x }) as EmailOutbox,
    ),
    save: jest.fn(
      async (x: EmailOutbox) => (rows.includes(x) || rows.push(x), x),
    ),
    findOneBy: jest.fn(
      async ({ id }: { id: string }) => rows.find((r) => r.id === id) ?? null,
    ),
    update: jest.fn(async (id: string, patch: Partial<EmailOutbox>) =>
      Object.assign(rows.find((r) => r.id === id)!, patch),
    ),
  };
  const queue = { add: jest.fn(async () => undefined) };
  const smtp = { send: jest.fn(async () => undefined) };
  return {
    outbox,
    queue,
    smtp,
    enqueue: new EnqueueEmailUseCase(outbox as never, queue as never),
    worker: new EmailProcessor(outbox as never, smtp as never),
  };
}

const job = (id: string, attemptsMade = 0) =>
  ({ data: { id }, attemptsMade, opts: { attempts: 5 } }) as unknown as Job<{
    id: string;
  }>;
const msg = {
  to: 'ana@aula.test',
  subject: 'Hola',
  text: 't',
  html: '<p>t</p>',
};

describe('EmailOutbox', () => {
  it('send() (puerto IMailService) guarda la fila pendiente y encola con su id', async () => {
    const s = setup();
    await s.enqueue.send(msg);
    expect(s.outbox.rows[0]).toMatchObject({
      to: 'ana@aula.test',
      status: 'pending',
      attempts: 0,
    });
    expect(s.queue.add).toHaveBeenCalledWith(
      { id: 'e1' },
      expect.objectContaining({ jobId: 'e1', attempts: 5 }),
    );
  });

  it('el worker envía una sola vez (un trabajo repetido no reenvía)', async () => {
    const s = setup();
    const row = await s.enqueue.execute(msg);
    await s.worker.send(job(row.id));
    await s.worker.send(job(row.id));
    expect(s.smtp.send).toHaveBeenCalledTimes(1);
    expect(row).toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('SMTP caído: sigue «pending» y relanza; en el último intento queda «failed» y el ADMIN lo reintenta', async () => {
    const s = setup();
    s.smtp.send.mockRejectedValue(new Error('ECONNREFUSED'));
    const row = await s.enqueue.execute(msg);
    await expect(s.worker.send(job(row.id, 0))).rejects.toThrow('ECONNREFUSED');
    expect(row.status).toBe('pending');
    await expect(s.worker.send(job(row.id, 4))).rejects.toThrow();
    expect(row).toMatchObject({ status: 'failed', lastError: 'ECONNREFUSED' });
    const retry = new RetryEmailUseCase(s.outbox as never, s.queue as never);
    expect((await retry.execute(row.id)).status).toBe('pending');
    await expect(retry.execute(row.id)).rejects.toThrow(/fallido/); // Ya no está fallido
  });
});
