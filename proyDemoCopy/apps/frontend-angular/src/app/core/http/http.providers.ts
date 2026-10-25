import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders } from '@angular/core';
import { credentialsInterceptor } from './credentials.interceptor';
import { envelopeInterceptor } from './envelope.interceptor';
import { errorInterceptor } from './error.interceptor';
import { notifyInterceptor } from './notify.interceptor';
// [provideHttp · core/http]: HttpClient con fetch nativo + cadena de interceptores | [Patrón]: Facade de providers + Chain of Responsibility | [Principio]: SRP (app.config solo compone) + OCP (un interceptor nuevo = una línea)

// `withFetch()` (Angular): usa la Fetch API (más ligera que XHR) | orden: credenciales → envelope → errores → aviso de éxito (2026-10-19)
export const provideHttp = (): EnvironmentProviders =>
  provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor, envelopeInterceptor, errorInterceptor, notifyInterceptor]));
