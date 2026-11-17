import type { Provider } from '@angular/core';
import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { CertificatesFacade } from './application/certificates.facade';
import { CertificatesRepository } from './domain/certificates.repository.port';
import { CertificatesHttpRepository } from './infrastructure/certificates.http-repository';
// [Rutas Certificates · Sprint 7.8 → Caso E 2026-11-13]: /certificados (con sesión) y /certificados/verificar[/:code] (PÚBLICA: la del QR) — lazy
// [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading + mínimo privilegio
// [Integración]: Next.js reescribe /certificados (protegido) y deja pública /certificados/verificar (ANGULAR_PUBLIC_PREFIXES); /verificar redirige (308)

const PROVIDERS: Provider[] = [
  { provide: CertificatesRepository, useClass: CertificatesHttpRepository },
  CertificatesFacade,
];
const verify = () => import('./presentation/pages/certificate-verify.page');

// [Pública]: sin guard — cualquiera con el código o el hash verifica (va ANTES que '' → no hereda el roleGuard)
const VERIFY: Routes[number] = {
  path: 'verificar',
  providers: PROVIDERS,
  children: [
    { path: '', title: 'Verificar certificado · Aula de Idiomas', loadComponent: verify },
    { path: ':code', title: 'Verificar certificado · Aula de Idiomas', loadComponent: verify },
  ],
};

export const CERTIFICATES_ROUTES: Routes = [
  VERIFY,
  {
    path: '',
    providers: PROVIDERS,
    canActivate: [roleGuard()],
    title: 'Mis certificados · Aula de Idiomas',
    loadComponent: () => import('./presentation/pages/certificates.page'),
  },
];
