import { createHash } from 'node:crypto';
import { IssueCertificateUseCase } from '../../../../src/modules/certificates/application/use-cases/issue-certificate.use-case';
import { RevokeCertificateUseCase } from '../../../../src/modules/certificates/application/use-cases/revoke-certificate.use-case';
import {
  ListMyCertificatesUseCase,
  VerifyCertificateUseCase,
} from '../../../../src/modules/certificates/application/use-cases/verify-certificate.use-case';
import type { Certificate } from '../../../../src/modules/certificates/domain/entities/certificate.entity';
import { CertificatePdfRenderer } from '../../../../src/modules/certificates/infrastructure/pdf/certificate-pdf.renderer';
import { VerifyCertificateHashUseCase } from '../../../../src/modules/web3/application/use-cases/verify-certificate-hash.use-case';
import { FakeBlockchainAdapter } from '../../../../src/modules/web3/infrastructure/chain/fake-blockchain.adapter';
// [Suite Certificates · Sprint 7.8]: emitir solo al 100 % (idempotente), PDF real con huella SHA-256, anclaje por evento, verificación pública contra la cadena falsa y revocación | [Patrón]: Test Double (repositorio y almacén en memoria + FakeBlockchainAdapter) | [Herramienta]: Jest

// [repo]: Repository<Certificate> mínimo en memoria (findOneBy/find/save/create/update)
function repo(rows: Certificate[] = []) {
  const match = (r: Certificate, w: Partial<Certificate>) =>
    Object.entries(w).every(([k, v]) => r[k as keyof Certificate] === v);
  return {
    rows,
    findOneBy: jest.fn(
      async (w: Partial<Certificate>) => rows.find((r) => match(r, w)) ?? null,
    ),
    find: jest.fn(async ({ where }: { where: Partial<Certificate> }) =>
      rows.filter((r) => match(r, where)),
    ),
    create: jest.fn(
      (x: Partial<Certificate>) => ({ id: 'c1', ...x }) as Certificate,
    ),
    save: jest.fn(async (x: Certificate) => {
      if (!rows.includes(x)) rows.push(x);
      return x;
    }),
    update: jest.fn(
      async (w: Partial<Certificate>, patch: Partial<Certificate>) => {
        rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, patch));
      },
    ),
  };
}

const enrollment = (progress: number) => ({
  userId: 'u1',
  courseId: 'k1',
  progress,
  purchasedAt: new Date(),
});

function setup(progress = 100) {
  const certificates = repo();
  const courses = {
    findById: jest.fn(async () => ({
      id: 'k1',
      title: 'Inglés A1',
      category: 'A1',
    })),
    getEnrollment: jest.fn(async () => enrollment(progress)),
    listEnrollmentsByUser: jest.fn(async () => [enrollment(progress)]),
  };
  const users = {
    findById: jest.fn(async () => ({
      id: 'u1',
      email: 'ana@aula.test',
      firstName: 'Ana',
      lastName: 'Pérez',
    })),
  };
  const store = { put: jest.fn(async () => undefined) };
  const anchor = { execute: jest.fn(async () => ({ queued: true })) };
  const issue = new IssueCertificateUseCase(
    certificates as never,
    courses as never,
    users as never,
    new CertificatePdfRenderer(),
    store as never,
    anchor as never,
  );
  return { certificates, courses, store, anchor, issue };
}

describe('IssueCertificateUseCase', () => {
  it('rechaza un curso sin terminar', async () => {
    const { issue } = setup(80);
    await expect(issue.execute('u1', 'k1')).rejects.toThrow(/100 %/);
  });

  it('emite un PDF real, guarda su huella, lo encola para anclar y es idempotente', async () => {
    const { issue, store, anchor } = setup();
    const cert = await issue.execute('u1', 'k1');
    expect(cert.code).toMatch(/^AULA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(cert.recipientName).toBe('Ana Pérez');
    expect(cert.cefrLevel).toBe('A1'); // Banda MCER del curso → color del diploma
    const [, bytes] = store.put.mock.calls[0] as unknown as [string, Buffer];
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); // pdfmake generó un PDF de verdad
    expect(cert.pdfSha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(anchor.execute).toHaveBeenCalledWith(cert.pdfSha256, cert.id);
    expect(await issue.execute('u1', 'k1')).toBe(cert); // Segunda petición = mismo certificado
    expect(store.put).toHaveBeenCalledTimes(1);
  });

  it('curso sin banda MCER: cefrLevel null (diploma en morado de marca)', async () => {
    const { issue, courses } = setup();
    courses.findById.mockResolvedValueOnce({
      id: 'k1',
      title: 'Taller',
      category: 'DIPLOMADO',
    } as never);
    expect((await issue.execute('u1', 'k1')).cefrLevel).toBeNull();
  });

  it('sin anclaje configurado (503) el certificado se emite igual', async () => {
    const { issue, anchor } = setup();
    anchor.execute.mockRejectedValueOnce(new Error('Anclaje no configurado'));
    expect((await issue.execute('u1', 'k1')).anchorTxHash).toBeNull();
  });
});

describe('VerifyCertificateUseCase + anclaje', () => {
  async function anchored() {
    const s = setup();
    const cert = await s.issue.execute('u1', 'k1');
    const chain = new FakeBlockchainAdapter();
    const txHash = await chain.sendTransaction({
      to: chain.platformAddress,
      data: `0x${cert.pdfSha256}`,
    });
    await s.issue.onHashAnchored({
      ref: cert.id,
      hash: cert.pdfSha256,
      txHash,
    }); // Evento `web3.hash-anchored`
    const verify = new VerifyCertificateUseCase(
      s.certificates as never,
      new VerifyCertificateHashUseCase(chain),
    );
    return { ...s, cert, chain, txHash, verify };
  }

  it('por código y por transacción: válido si la cadena guarda el mismo hash', async () => {
    const { cert, txHash, verify } = await anchored();
    const byCode = await verify.byCode(cert.code.toLowerCase()); // El código se normaliza a mayúsculas
    expect(byCode).toMatchObject({
      valid: true,
      anchor: { txHash, onchainValid: true },
    });
    expect(byCode).not.toHaveProperty('userId'); // Vista pública sin ids internos
    expect((await verify.byTx(txHash)).code).toBe(cert.code);
  });

  it('un PDF alterado (otro hash) deja de ser válido', async () => {
    const { cert, verify } = await anchored();
    cert.pdfSha256 = 'f'.repeat(64);
    expect((await verify.byCode(cert.code)).valid).toBe(false);
  });

  it('revocado: la verificación pública lo muestra inválido con el motivo', async () => {
    const { cert, certificates, verify } = await anchored();
    await new RevokeCertificateUseCase(certificates as never).execute(
      cert.id,
      'Reembolso',
    );
    expect(await verify.byCode(cert.code)).toMatchObject({
      valid: false,
      status: 'revoked',
      revokeReason: 'Reembolso',
    });
  });
});

describe('ListMyCertificatesUseCase', () => {
  it('ofrece «solicitar» solo para cursos al 100 % sin certificado', async () => {
    const { certificates, courses, issue } = setup();
    const list = new ListMyCertificatesUseCase(
      certificates as never,
      courses as never,
    );
    expect((await list.execute('u1')).eligible).toEqual([
      { courseId: 'k1', title: 'Inglés A1' },
    ]);
    await issue.execute('u1', 'k1');
    expect(await list.execute('u1')).toMatchObject({
      eligible: [],
      items: [{ courseId: 'k1' }],
    });
  });
});
