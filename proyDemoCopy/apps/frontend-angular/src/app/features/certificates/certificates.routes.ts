import type { Provider } from '@angular/core';
import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { CertificatesFacade } from './application/certificates.facade';
import { CertificatesRepository } from './domain/certificates.repository.port';
import { CertificatesHttpRepository } from './infrastructure/certificates.http-repository';
// [Rutas Certificates · Sprint 7.8]: /certificados (con sesión) y /verificar, /verificar/:code (públicas) — lazy | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading + mínimo privilegio
// [Integración]: Next.js reescribe /certificados (ANGULAR_PREFIXES, protegido) y /verificar (ANGULAR_PUBLIC_PREFIXES, sin sesión)

const PROVIDERS: Provider[] = [
  { provide: CertificatesRepository, useClass: CertificatesHttpRepository },
  CertificatesFacade,
];
const verify = () => import('./presentation/pages/certificate-verify.page');

export const CERTIFICATES_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS,
    canActivate: [roleGuard()],
    title: 'Mis certificados · Aula de Idiomas',
    loadComponent: () => import('./presentation/pages/certificates.page'),
  },
];

// [Pública]: sin guard — cualquiera con el código o el hash verifica
export const VERIFY_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS,
    children: [
      { path: '', title: 'Verificar certificado · Aula de Idiomas', loadComponent: verify },
      { path: ':code', title: 'Verificar certificado · Aula de Idiomas', loadComponent: verify },
    ],
  },
];
