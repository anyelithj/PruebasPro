import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
// [AvatarSvgComponent · Átomo · Sprint 9.7]: personaje guía «Aula» en SVG — cara con el degradado morado de la marca, ojos que parpadean y boca que se abre según `mouth` (0..1) | [Patrón]: Atomic Design (átomo) + Presentational Component | [Principio]: SRP (solo dibuja; el volumen lo calcula LipSyncService) | [Paradigma]: Declarativo
// [A11y]: decorativo (`aria-hidden`) — el estado se dice en texto en AvatarStage · `motion-safe:` → sin parpadeo con prefers-reduced-motion
// [Distinto del avatar de perfil]: AvatarCard (foto o iniciales del usuario) no se toca; este es un personaje de la plataforma

@Component({
  selector: 'aula-avatar-svg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  template: `
    <svg
      [attr.viewBox]="'0 0 120 120'"
      [attr.width]="size()"
      [attr.height]="size()"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <!-- [Marca]: mismo degradado índigo → violeta → fucsia que --gradient-brand -->
        <linearGradient [attr.id]="gid()" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" [attr.stop-color]="tone()[0]" />
          <stop offset="55%" [attr.stop-color]="tone()[1]" />
          <stop offset="100%" [attr.stop-color]="tone()[2]" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" [attr.fill]="'url(#' + gid() + ')'" />
      <circle
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke="white"
        stroke-opacity="0.25"
        stroke-width="3"
      />
      <!-- Ojos con parpadeo (escala vertical) -->
      <g
        class="origin-center motion-safe:animate-[aula-blink_4.5s_ease-in-out_infinite]"
        style="transform-box: fill-box"
      >
        <ellipse cx="42" cy="52" rx="6" ry="7.5" fill="white" />
        <ellipse cx="78" cy="52" rx="6" ry="7.5" fill="white" />
        <circle cx="43" cy="53" r="3" fill="#1e1b4b" />
        <circle cx="79" cy="53" r="3" fill="#1e1b4b" />
      </g>
      <!-- Mejillas -->
      <circle cx="33" cy="70" r="6" fill="#f0abfc" fill-opacity="0.45" />
      <circle cx="87" cy="70" r="6" fill="#f0abfc" fill-opacity="0.45" />
      <!-- Boca: alto proporcional al volumen; sonrisa cuando está cerrada -->
      @if (mouthOpen() > 0.08) {
        <ellipse cx="60" cy="80" rx="12" [attr.ry]="2 + mouthOpen() * 11" fill="#1e1b4b" />
        <ellipse
          cx="60"
          [attr.cy]="83 + mouthOpen() * 5"
          rx="7"
          [attr.ry]="1 + mouthOpen() * 4"
          fill="#fb7185"
        />
      } @else {
        <path
          d="M47 78 Q60 88 73 78"
          fill="none"
          stroke="#1e1b4b"
          stroke-width="3.5"
          stroke-linecap="round"
        />
      }
    </svg>
  `,
  styles: `
    @keyframes aula-blink {
      0%,
      92%,
      100% {
        transform: scaleY(1);
      }
      95% {
        transform: scaleY(0.1);
      }
    }
  `,
})
export class AvatarSvgComponent {
  readonly mouth = input(0); // 0..1
  readonly size = input(120);
  readonly variant = input<'brand' | 'alt'>('brand'); // alt = segundo hablante de un diálogo (tonos cian → violeta)
  protected readonly mouthOpen = computed(() => Math.max(0, Math.min(1, this.mouth())));
  protected readonly tone = computed(() =>
    this.variant() === 'alt'
      ? ['#0ea5e9', '#6366f1', '#8b5cf6']
      : ['#6366f1', '#8b5cf6', '#d946ef'],
  );
  // [Id único]: dos avatares en la misma página no comparten el degradado
  private static seq = 0;
  protected readonly gid = computed(() => `aula-avatar-${this.variant()}-${this.uid}`);
  private readonly uid = ++AvatarSvgComponent.seq;
}
