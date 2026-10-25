import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { LOCALES, type Locale } from '@core/i18n/locale.token';
import { THEME_META, THEMES, ThemeService, type ThemeKey } from '@core/theme/theme.service';
import { IconComponent } from '../../atoms/icon/icon.component';
import { DropdownComponent } from '../../molecules/dropdown/dropdown.component';
// [ThemeMenu + LanguageMenu · Organismo]: selectores de tema e idioma del topbar — réplica de PortalToolbar.tsx de Next.js (mismos textos, banderas, puntos de color y orden) | [Patrón]: Composite (sobre la molécula Dropdown) | [Principio]: DRY (temas e idiomas del SSOT de Next.js) + SRP | [Paradigma]: Declarativo
// [WAI-ARIA]: opciones `menuitemradio` + `aria-checked`

// [FlagComponent]: banderas SVG idénticas a las de Next.js (ES = Colombia, EN = Reino Unido) | `aria-hidden`: decorativas, el idioma ya va en texto
@Component({
  selector: 'aula-flag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (locale() === 'es') {
      <svg [attr.width]="size()" [attr.height]="size() * 0.75" viewBox="0 0 16 12" class="block shrink-0 rounded-[2px]" aria-hidden="true">
        <rect width="16" height="4" fill="#FCD116" />
        <rect y="4" width="16" height="4" fill="#003087" />
        <rect y="8" width="16" height="4" fill="#CE1126" />
      </svg>
    } @else {
      <svg [attr.width]="size()" [attr.height]="size() * 0.722" viewBox="0 0 18 13" class="block shrink-0 rounded-[2px]" aria-hidden="true">
        <rect width="18" height="13" fill="#012169" />
        <polygon points="0,0 18,13 18,10.8 2.2,0" fill="#fff" />
        <polygon points="0,2.2 15.8,13 18,13 2.2,0 0,0" fill="#C8102E" />
        <polygon points="18,0 0,13 0,10.8 15.8,0" fill="#fff" />
        <polygon points="15.8,0 0,10.8 0,13 2.2,13 18,2.2" fill="#C8102E" />
        <rect x="7" width="4" height="13" fill="#fff" />
        <rect y="4.5" width="18" height="4" fill="#fff" />
        <rect x="7.8" width="2.4" height="13" fill="#C8102E" />
        <rect y="5.3" width="18" height="2.4" fill="#C8102E" />
      </svg>
    }
  `,
})
export class FlagComponent {
  readonly locale = input.required<Locale>();
  readonly size = input(16);
}

// [Clases de opción]: mismas utilidades que OptionList de Next.js | [Principio]: DRY entre los dos menús
const OPTION = 'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';

@Component({
  selector: 'aula-theme-menu',
  imports: [DropdownComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.shell().toolbar;
    <aula-dropdown #dd [label]="t.changeTheme">
      <span trigger class="contents">
        <span aria-hidden="true">{{ meta[theme.theme()].icon }}</span>
        <span class="hidden max-w-[72px] truncate sm:inline">{{ t.themesShort[theme.theme()] }}</span>
        <aula-icon name="chevron-down" [size]="12" class="opacity-60" />
      </span>
      <ul class="py-1">
        <!-- [Opciones]: derivadas del SSOT de temas (bloque de control de flujo «for» con track) -->
        @for (key of themes; track key) {
          <li role="none">
            <button type="button" role="menuitemradio" [attr.aria-checked]="key === theme.theme()" (click)="theme.set(key); dd.close()" [class]="option" [class.bg-muted]="key === theme.theme()" [class.font-bold]="key === theme.theme()">
              <span class="size-3.5 shrink-0 rounded-full" [style.background]="meta[key].dot" [style.border]="'2px solid ' + meta[key].border" aria-hidden="true"></span>
              <span class="flex-1">{{ t.themes[key] }}</span>
              @if (key === theme.theme()) {
                <aula-icon name="check" [size]="14" class="text-primary" />
              }
            </button>
          </li>
        }
      </ul>
    </aula-dropdown>
  `,
})
export class ThemeMenuComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly themes: readonly ThemeKey[] = THEMES;
  protected readonly meta = THEME_META;
  protected readonly option = OPTION;
}

@Component({
  selector: 'aula-language-menu',
  imports: [DropdownComponent, IconComponent, FlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.shell().toolbar;
    <aula-dropdown #dd [label]="t.changeLanguage">
      <span trigger class="contents">
        <aula-flag [locale]="i18n.locale()" />
        <span class="tracking-wider">{{ i18n.locale().toUpperCase() }}</span>
        <aula-icon name="chevron-down" [size]="12" class="opacity-60" />
      </span>
      <ul class="py-1">
        @for (key of locales; track key) {
          <li role="none">
            <button type="button" role="menuitemradio" [attr.aria-checked]="key === i18n.locale()" (click)="i18n.use(key); dd.close()" [class]="option" [class.bg-muted]="key === i18n.locale()" [class.font-bold]="key === i18n.locale()">
              <aula-flag [locale]="key" [size]="18" />
              <span class="flex-1">{{ t.languages[key] }}</span>
              @if (key === i18n.locale()) {
                <aula-icon name="check" [size]="14" class="text-primary" />
              }
            </button>
          </li>
        }
      </ul>
    </aula-dropdown>
  `,
})
export class LanguageMenuComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly locales = LOCALES;
  protected readonly option = OPTION;
}
