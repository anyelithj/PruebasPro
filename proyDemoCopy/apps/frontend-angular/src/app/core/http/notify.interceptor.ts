import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { ToastService } from '@core/feedback/toast.service';
import { I18nService } from '@core/i18n/i18n.service';
// [notifyInterceptor · core/http · 2026-10-19]: TODA alta, edición o borrado que responde 2xx avisa «Registro guardado / editado / eliminado» | [Patrón]: Interceptor (AOP) | [Principio]: DRY + OCP (formularios nuevos avisan sin código extra) | [Paradigma]: Funcional + Reactivo
// [Excluidas]: peticiones que no son CRUD (transcribir, IA, juego, pago, exportar…) → no se avisa de lo que el usuario no percibe como «guardar»

export const NOT_CRUD =
  /\/(speech|auth|events|ai|lookup|attempts|rounds|turn|turns|draft|review|ask|chat|writing-corrections|nonce|verify|checkout-session|end|finish|practice|reindex|ipa|enrich|align|export|tx|orders|payments|flashcards|study-plan|fluency|conversations|sessions|extract-text|import-url)(\/|$|\?)/; // [2026-10-23]: leer texto de un archivo o enlace no guarda nada → sin toast

export const notifyInterceptor: HttpInterceptorFn = (req, next) => {
  const verb = req.method;
  if (verb === 'GET' || verb === 'HEAD' || NOT_CRUD.test(req.url)) return next(req);
  const toast = inject(ToastService);
  const i18n = inject(I18nService);
  return next(req).pipe(
    tap((ev) => {
      if (!(ev instanceof HttpResponse) || !ev.ok) return;
      const c = i18n.t().common;
      const status = /\/status(\?|$)/.test(req.url) ? (req.body as { status?: string } | null)?.status : undefined; // [2026-10-23]
      if (status === 'review') return; // Paso intermedio de Música (borrador → revisión → publicada): un solo aviso al final
      toast.success(
        status === 'published' ? c.published : status === 'draft' ? c.unpublished : verb === 'DELETE' ? c.deleted : verb === 'POST' ? c.saved : c.updated,
      );
    }),
  );
};
