"use client"; // [Next.js]: Client Component → selección de tema/idioma
import { ChevronDown, Check } from "lucide-react"; // [lucide-react]: iconos SVG tree-shakeables
import { cn } from "@/lib/utils";
import { THEMES, THEME_META, type ThemeKey } from "@aula/ui-tokens/tailwind-preset";
import { LOCALES, type Locale } from "@aula/shared-i18n";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { Dropdown } from "./Dropdown";
// [ThemeMenu + LanguageMenu]: selectores de tema e idioma (réplica del topbar de NeuroLearning) usados en el portal y en la landing | [Patrón]: Composite + Generic Component (OptionList) | [Principio]: DRY + SRP | [Paradigma]: Declarativo

// ── Banderas SVG (idénticas al original): ES = Colombia, EN = Reino Unido ──
// `aria-hidden` (WAI-ARIA): decorativas; el nombre del idioma ya va en texto
function FlagES({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.75)} viewBox="0 0 16 12" className="block shrink-0 rounded-[2px]" aria-hidden>
      <rect width="16" height="4" fill="#FCD116" />
      <rect y="4" width="16" height="4" fill="#003087" />
      <rect y="8" width="16" height="4" fill="#CE1126" />
    </svg>
  );
}

function FlagEN({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.722)} viewBox="0 0 18 13" className="block shrink-0 rounded-[2px]" aria-hidden>
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
  );
}

// `Record<Locale, …>` (TS): bandera por idioma | [Patrón]: Lookup Table (evita if/else)
const FLAGS: Record<Locale, typeof FlagES> = { es: FlagES, en: FlagEN };

// [OptionList]: opciones tipo radio de un menú | `<T extends string>` (TS Generics): sirve para ThemeKey y Locale | [WAI-ARIA]: menuitemradio + aria-checked
function OptionList<T extends string>({ options, current, onSelect }: { options: ReadonlyArray<{ value: T; label: string; icon: React.ReactNode }>; current: T; onSelect: (v: T) => void }) {
  return (
    <ul className="py-1">
      {options.map((opt) => {
        const selected = opt.value === current;
        return (
          <li key={opt.value} role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onSelect(opt.value)}
              className={cn("flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none", selected && "bg-muted font-bold")}
            >
              {opt.icon}
              <span className="flex-1">{opt.label}</span>
              {selected && <Check className="size-3.5 text-primary" aria-hidden />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// [ThemeDot]: punto de color de muestra del tema (igual al dropdown original)
function ThemeDot({ theme }: { theme: ThemeKey }) {
  const meta = THEME_META[theme];
  return <span className="size-3.5 shrink-0 rounded-full" style={{ background: meta.dot, border: `2px solid ${meta.border}` }} aria-hidden />;
}

// `themes` (prop): subconjunto permitido (las páginas públicas pasan solo Claro/Oscuro) | por defecto los 6
export function ThemeMenu({ themes = THEMES }: { themes?: ReadonlyArray<ThemeKey> }) {
  const { t, theme, setTheme } = usePreferences();
  return (
    <Dropdown
      // [A11y · WCAG 2.5.3 «Label in Name»]: el nombre accesible incluye el texto visible (tema actual)
      label={`${t.toolbar.changeTheme}: ${t.toolbar.themesShort[theme]}`}
      trigger={
        <>
          <span aria-hidden>{THEME_META[theme].icon}</span>
          <span className="hidden max-w-[72px] truncate sm:inline">{t.toolbar.themesShort[theme]}</span>
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </>
      }
    >
      {(close) => (
        <OptionList<ThemeKey>
          current={theme}
          onSelect={(v) => {
            setTheme(v);
            close();
          }}
          // `THEMES.map` (ES5): opciones derivadas del SSOT de temas | [Principio]: DRY
          options={themes.map((key) => ({ value: key, label: t.toolbar.themes[key], icon: <ThemeDot theme={key} /> }))}
        />
      )}
    </Dropdown>
  );
}

export function LanguageMenu() {
  const { t, locale, setLocale } = usePreferences();
  const Flag = FLAGS[locale];
  return (
    <Dropdown
      label={`${t.toolbar.changeLanguage}: ${locale.toUpperCase()}`} // [A11y · WCAG 2.5.3]: incluye el texto visible («ES»)
      trigger={
        <>
          <Flag />
          <span className="tracking-wider">{locale.toUpperCase()}</span>
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </>
      }
    >
      {(close) => (
        <OptionList<Locale>
          current={locale}
          onSelect={(v) => {
            setLocale(v);
            close();
          }}
          options={LOCALES.map((key) => {
            const OptionFlag = FLAGS[key];
            return { value: key, label: t.toolbar.languages[key], icon: <OptionFlag size={18} /> };
          })}
        />
      )}
    </Dropdown>
  );
}
