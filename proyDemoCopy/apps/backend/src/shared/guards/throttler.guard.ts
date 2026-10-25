import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
// [Throttler personalizado]: rate limit por IP con tracker custom | [Patrón]: Guard | [Principio]: OCP | [Paradigma]: AOP

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  // [Tracker IP]: prioriza X-Forwarded-For (proxy) sobre remoteAddress | [Principio]: SRP
  // Sin `async`: no hay nada que esperar → `Promise.resolve` cumple la firma de ThrottlerGuard
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    // [Header forwarded]: necesario detrás de Nginx/CDN
    const forwarded = req.headers as Record<string, string | undefined>;
    const ip =
      forwarded?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      (req.ip as string | undefined) ??
      'unknown';
    return Promise.resolve(ip);
  }
}
