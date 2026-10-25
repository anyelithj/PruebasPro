import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { explorerTxUrl } from '@core/web3/chains';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { RouterLink } from '@angular/router';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component'; // [2026-10-24]: «Volver a certificados» uniforme
import { SessionService } from '@core/auth/session.service';
import { CertificatesFacade } from '../../application/certificates.facade';
// [CertificateVerifyPage · Presentación]: /verificar y /verificar/:code — verificación PÚBLICA por código (AULA-XXXX-XXXX) o por hash de la transacción de Sepolia (RF-93); el resultado se pinta como diploma con el color de su nivel MCER | [Patrón]: Container + Máquina de estados | [Principio]: SRP + DIP (fachada) + Fail Fast (formato validado antes de llamar) | [Paradigma]: Declarativo + Reactivo
// [Sin sesión]: ruta en ANGULAR_PUBLIC_PREFIXES de Next.js; AppComponent la pinta sin sidebar para visitantes · [A11y]: resultado en role="status", errores en role="alert", veredicto con icono + texto

@Component({
  selector: 'aula-certificate-verify-page',
  imports: [
    RouterLink,
    BackLinkComponent,
    CardPageTemplate,
    FormFieldComponent,
    BadgeComponent,
    ButtonComponent,
    SpinnerComponent,
    LevelTintDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().certificates;
    <aula-card-page [heading]="t.verifyTitle" [subtitle]="t.verifySubtitle">
      <!-- [Volver · 2026-10-24]: con sesión → «Volver a certificados» encima del título (slot pageBack); un visitante sin sesión no tiene «Mis certificados» -->
      @if (session.isAuthenticated()) {
        <a pageBack aulaBackLink routerLink="/certificados">{{ t.backToCertificates }}</a>
      }
      <!-- (submit) nativo: Enter también envía; preventDefault evita recargar la página -->
      <form
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
        (submit)="$event.preventDefault(); check()"
      >
        <aula-form-field
          class="flex-1"
          fieldId="cert-lookup"
          [label]="t.lookup"
          [hint]="t.lookupHint"
        >
          <input
            id="cert-lookup"
            class="control w-full eeg-mono"
            autocomplete="off"
            spellcheck="false"
            aria-describedby="cert-lookup-hint"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </aula-form-field>
        <button aulaButton type="submit" [loading]="facade.verification.loading()">
          {{ t.verify }}
        </button>
      </form>

      <div class="mt-6" aria-live="polite">
        @switch (facade.verification.status()) {
          @case ('loading') {
            <aula-spinner [label]="t.checking" />
          }
          @case ('error') {
            <p role="alert" class="text-sm text-tone-danger">{{ facade.verification.error() }}</p>
          }
          @case ('success') {
            @let r = facade.verification.data()!;
            <!-- [Diploma]: panel oscuro fijo (igual en los 6 temas) con escuadras, sello y acentos del color del nivel MCER -->
            <section
              role="status"
              aria-labelledby="cert-result"
              [aulaLevel]="r.cefrLevel"
              class="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]"
            >
              <article
                class="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117] px-6 py-8 text-center text-white shadow-lg"
              >
                @for (c of corners; track c) {
                  <span
                    aria-hidden="true"
                    class="absolute size-5 border-(--lvl) opacity-80"
                    [class]="c"
                  ></span>
                }
                <div
                  class="mx-auto mb-3 grid size-16 place-items-center rounded-full border-2 border-(--lvl) bg-(--lvl)/15 text-xl font-extrabold text-(--lvl)"
                >
                  {{ r.cefrLevel ?? '★' }}
                </div>
                <p class="text-[10px] font-extrabold tracking-[0.2em] text-(--lvl) uppercase">
                  Aula de Idiomas · {{ r.cefrLevel ? t.level + ' ' + r.cefrLevel : t.general }}
                </p>
                <p class="mt-3 text-xs text-white/60">{{ t.certifies }}</p>
                <p class="mt-1 text-2xl font-extrabold">{{ r.recipientName }}</p>
                <p class="mt-1 text-xs text-white/60">{{ t.completed }}</p>
                <h2 id="cert-result" class="mt-1 text-lg leading-snug font-bold text-(--lvl)">
                  {{ r.courseTitle }}
                </h2>
                <hr class="my-5 border-white/10" />
                <div class="flex items-center justify-center gap-6">
                  <div>
                    <p class="eeg-mono text-sm font-bold">{{ r.code }}</p>
                    <p class="text-[10px] text-white/50">{{ t.code }}</p>
                  </div>
                  <span class="h-9 w-px bg-white/20" aria-hidden="true"></span>
                  <div>
                    <p class="eeg-mono text-sm font-bold">
                      <time [attr.datetime]="r.issuedAt">{{ date(r.issuedAt) }}</time>
                    </p>
                    <p class="text-[10px] text-white/50">{{ t.date }}</p>
                  </div>
                </div>
                <!-- [QR]: marco en el color del nivel (como el diploma de NeuroLearning) · SVG de NestJS con la librería qrcode -->
                <div
                  class="mt-5 inline-block rounded-xl border-2 border-(--lvl) bg-(--lvl)/15 p-2.5"
                >
                  <img
                    [src]="facade.qrUrl(r.code)"
                    width="112"
                    height="112"
                    [alt]="t.qrAlt + ' ' + r.code"
                    class="block size-28 rounded-md bg-white"
                  />
                </div>
                <div class="mt-5 flex items-center justify-center gap-2">
                  <span
                    class="eeg-mono max-w-[16rem] truncate text-[10px] text-white/45"
                    [title]="r.pdfSha256"
                    >SHA-256 {{ r.pdfSha256 }}</span
                  >
                  <button
                    type="button"
                    class="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/20"
                    (click)="copy(r.pdfSha256)"
                  >
                    {{ copied() ? t.copied : t.copy }}
                  </button>
                </div>
              </article>

              <!-- [Veredicto + cadena]: tarjeta clara con el resultado en texto -->
              <aside class="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                <aula-badge [tone]="r.valid ? 'info' : 'danger'" [icon]="r.valid ? 'check' : 'x'">{{
                  r.valid ? t.valid : t.invalid
                }}</aula-badge>
                @if (r.status === 'revoked') {
                  <p class="text-tone-danger">
                    {{ t.revoked }}{{ r.revokeReason ? ': ' + r.revokeReason : '' }}
                  </p>
                }
                <dl class="divide-y divide-border">
                  <div class="flex justify-between gap-2 py-1.5">
                    <dt class="text-muted-foreground">{{ t.level }}</dt>
                    <dd class="font-semibold">{{ r.cefrLevel ?? t.general }}</dd>
                  </div>
                  <div class="flex justify-between gap-2 py-1.5">
                    <dt class="text-muted-foreground">{{ t.network }}</dt>
                    <dd class="font-semibold">Sepolia</dd>
                  </div>
                  @if (r.anchor; as a) {
                    <div class="flex justify-between gap-2 py-1.5">
                      <dt class="text-muted-foreground">{{ t.confirmationsLabel }}</dt>
                      <dd class="eeg-mono font-semibold">{{ a.confirmations }}</dd>
                    </div>
                  }
                </dl>
                @if (r.anchor; as a) {
                  <p>
                    {{ a.onchainValid ? t.onchainOk : t.onchainBad }} ·
                    {{ i18n.fmt(t.confirmations, { n: a.confirmations }) }}
                  </p>
                  <a
                    aulaButton
                    variant="outline"
                    size="sm"
                    class="w-full"
                    [href]="explorer(a.txHash)"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ t.explorer }}</a
                  >
                } @else {
                  <p class="text-muted-foreground">{{ t.notAnchored }}</p>
                }
              </aside>
            </section>
          }
        }
      </div>
    </aula-card-page>
  `,
})
export default class CertificateVerifyPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(CertificatesFacade);
  protected readonly session = inject(SessionService); // `isAuthenticated` (signal computed)
  readonly code = input<string>(); // /verificar/:code (withComponentInputBinding) · el QR del PDF llega aquí
  protected readonly query = signal('');
  protected readonly explorer = explorerTxUrl;
  protected readonly copied = signal(false);
  // [Escuadras]: 4 esquinas del diploma (posición + bordes que se dibujan)
  protected readonly corners = [
    'top-3 left-3 border-t-2 border-l-2',
    'top-3 right-3 border-t-2 border-r-2',
    'bottom-3 left-3 border-b-2 border-l-2',
    'bottom-3 right-3 border-b-2 border-r-2',
  ];

  constructor() {
    // `effect` (Angular): al llegar por el QR se verifica sin pulsar el botón
    effect(() => {
      const c = this.code();
      if (!c) return;
      this.query.set(c);
      void this.facade.verify(c, this.i18n.t().certificates.badFormat);
    });
  }

  protected check(): void {
    void this.facade.verify(this.query(), this.i18n.t().certificates.badFormat);
  }

  // [copy]: `navigator.clipboard` (Web API, requiere contexto seguro) · sin permiso → no hace nada (el hash sigue visible en `title`)
  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(
      () => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1800);
      },
      () => undefined,
    );
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString(this.i18n.intl());
  }
}
