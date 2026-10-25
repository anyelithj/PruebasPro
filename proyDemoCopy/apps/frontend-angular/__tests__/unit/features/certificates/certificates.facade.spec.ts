import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { CertificatesFacade } from '@features/certificates/application/certificates.facade';
import { CertificatesRepository } from '@features/certificates/domain/certificates.repository.port';
import { parseLookup, type Certificate } from '@features/certificates/domain/models/certificates';
// [Spec CertificatesFacade]: solicitar relee la lista, error del backend, formato inválido sin petición + regla pura `parseLookup` | [Patrón]: Test Double (repositorio falso)

const cert: Certificate = {
  id: 'c1',
  courseId: 'k1',
  code: 'AULA-7KQ2-M9XD',
  recipientName: 'Ana Pérez',
  courseTitle: 'Inglés A1',
  pdfSha256: 'a'.repeat(64),
  anchorTxHash: null,
  status: 'issued',
  revokeReason: null,
  issuedAt: '2026-10-16T00:00:00Z',
};

function setup(overrides: Partial<CertificatesRepository> = {}) {
  const repo = {
    mine: jest
      .fn()
      .mockReturnValueOnce(of({ items: [], eligible: [{ courseId: 'k1', title: 'Inglés A1' }] }))
      .mockReturnValue(of({ items: [cert], eligible: [] })),
    issue: jest.fn(() => of(cert)),
    verify: jest.fn(() => of({ ...cert, valid: true, anchor: null })),
    qrUrl: (code: string) => `/api/certificates/verify/${code}/qr`,
    pdfUrl: (id: string) => `/api/certificates/${id}/pdf`,
    ...overrides,
  } as unknown as CertificatesRepository;
  TestBed.configureTestingModule({ providers: [CertificatesFacade, { provide: CertificatesRepository, useValue: repo }] });
  return { facade: TestBed.inject(CertificatesFacade), repo };
}

describe('CertificatesFacade', () => {
  it('solicitar emite y relee: el curso pasa de «listo» a «emitido»', async () => {
    const { facade, repo } = setup();
    await facade.load();
    expect(facade.mine.data()?.eligible).toHaveLength(1);
    await facade.request('k1');
    expect(repo.issue).toHaveBeenCalledWith('k1');
    expect(facade.mine.data()).toEqual({ items: [cert], eligible: [] });
    expect(facade.issuing()).toBeNull();
  });

  it('error del backend (curso sin terminar) se muestra', async () => {
    const { facade } = setup({ issue: () => throwError(() => new ApiError(409, 'El certificado se emite al completar el 100 % del curso')) });
    expect(await facade.request('k1')).toBeNull();
    expect(facade.actionError()).toContain('100 %');
  });

  it('formato inválido: error local y ninguna petición', async () => {
    const { facade, repo } = setup();
    await facade.verify('hola', 'Formato no válido');
    expect(repo.verify).not.toHaveBeenCalled();
    expect(facade.verification.error()).toBe('Formato no válido');
  });

  it('parseLookup: código en minúsculas → mayúsculas · hash → tx en minúsculas · resto → null', () => {
    expect(parseLookup(' aula-7kq2-m9xd ')).toEqual({ kind: 'code', value: 'AULA-7KQ2-M9XD' });
    expect(parseLookup(`0x${'AB'.repeat(32)}`)).toEqual({ kind: 'tx', value: `0x${'ab'.repeat(32)}` });
    expect(parseLookup('AULA-0000-1111')).toBeNull(); // 0 y 1 no existen en el alfabeto del código
  });
});
