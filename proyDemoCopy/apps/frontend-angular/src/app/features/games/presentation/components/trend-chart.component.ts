import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
// [TrendChartComponent · Presentacional · Sprint 8.11]: gráfica de tendencia en SVG propio (sin librería de gráficas nueva) | [Patrón]: Presentational Component + función pura de escalado | [Principio]: YAGNI (una línea + puntos cubre el caso) + SRP | [Paradigma]: Declarativo + Funcional
// [A11y]: `role="img"` con resumen en `aria-label` (primer y último valor) + tabla de datos oculta para lectores de pantalla · [Tema]: colores por tokens (sigue claro/oscuro/VR) · [Responsive]: viewBox escalable

const W = 600;
const H = 180;
const PAD = 28;

@Component({
  selector: 'aula-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <figure class="surface p-4">
      <figcaption class="mb-2 text-sm font-bold">{{ title() }}</figcaption>
      <svg
        [attr.viewBox]="'0 0 ' + w + ' ' + h"
        class="h-auto w-full"
        role="img"
        [attr.aria-label]="summary()"
      >
        <!-- Línea base y máximo -->
        <line
          [attr.x1]="pad"
          [attr.x2]="w - pad"
          [attr.y1]="h - pad"
          [attr.y2]="h - pad"
          stroke="var(--border)"
        />
        <text [attr.x]="4" [attr.y]="pad" class="fill-[var(--muted-foreground)] text-[11px]">
          {{ max() }}
        </text>
        <text [attr.x]="4" [attr.y]="h - pad" class="fill-[var(--muted-foreground)] text-[11px]">
          0
        </text>
        @if (points().length > 1) {
          <polyline
            [attr.points]="line()"
            fill="none"
            stroke="url(#trend-gradient)"
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        }
        @for (p of points(); track $index) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4.5" fill="var(--btn-solid)">
            <title>{{ p.v }}</title>
          </circle>
        }
        <defs>
          <!-- Degradado de marca (índigo → violeta → fucsia) en el trazo -->
          <linearGradient id="trend-gradient" x1="0" x2="1">
            <stop offset="0" stop-color="#6366f1" />
            <stop offset=".5" stop-color="#8b5cf6" />
            <stop offset="1" stop-color="#d946ef" />
          </linearGradient>
        </defs>
      </svg>
      <table class="sr-only">
        <caption>
          {{
            title()
          }}
        </caption>
        <tbody>
          @for (v of values(); track $index) {
            <tr>
              <th scope="row">{{ $index + 1 }}</th>
              <td>{{ v }}</td>
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
})
export class TrendChartComponent {
  readonly title = input.required<string>();
  readonly values = input.required<number[]>(); // En orden cronológico
  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly max = computed(() => Math.max(1, Math.ceil(Math.max(...this.values(), 0))));
  // [Escalado]: índice → x uniforme · valor → y invertida (SVG crece hacia abajo)
  protected readonly points = computed(() => {
    const v = this.values();
    const step = v.length > 1 ? (W - 2 * PAD) / (v.length - 1) : 0;
    return v.map((val, i) => ({
      v: Math.round(val),
      x: PAD + i * step,
      y: H - PAD - (val / this.max()) * (H - 2 * PAD),
    }));
  });
  protected readonly line = computed(() =>
    this.points()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );
  protected readonly summary = computed(() => {
    const v = this.values();
    return v.length
      ? `${this.title()}: ${Math.round(v[0])} → ${Math.round(v[v.length - 1])}`
      : this.title();
  });
}
