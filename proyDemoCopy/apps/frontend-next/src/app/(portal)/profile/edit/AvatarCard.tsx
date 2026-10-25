"use client"; // [Next.js]: Client Component → selección interactiva y persistencia en localStorage
import { useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage"; // [Custom Hook existente]: estado persistido y sincronizado entre pestañas | [Principio]: DRY
import { usePreferences } from "@/components/layout/PreferencesProvider";
// [AvatarCard]: personalización del avatar humanoide (réplica de NeuroLearning) | [Patrón]: Presentational + Custom Hook (persistencia) + Composite (ColorSelector/OptionSelect) | [Principio]: SRP | [Paradigma]: Declarativo

// `type` (TS union literal): accesorios posibles del avatar
type Accessory = "none" | "glasses" | "headphones" | "cap" | "vr";

// `interface` (TS): configuración serializable del avatar (se guarda como JSON)
export interface AvatarConfig {
  skinColor: string;
  eyeColor: string;
  hairColor: string;
  clothesColor: string;
  accessory: Accessory;
}

// `{ color, key }`: `key` = clave de traducción en t.profile.options | `as const` (TS): tuplas inmutables
const EYE_COLORS = [
  { color: "#6366F1", key: "violet" }, // Violeta de marca (antes azul en el original)
  { color: "#1A8A9A", key: "cyan" },
  { color: "#22C55E", key: "green" },
  { color: "#F59E0B", key: "amber" },
  { color: "#FF6B6B", key: "red" },
  { color: "#6B7280", key: "gray" },
] as const;

const SKIN_COLORS = [
  { color: "#FDBCB4", key: "light" },
  { color: "#D4956A", key: "mediumLight" },
  { color: "#A0623A", key: "medium" },
  { color: "#7C3F1E", key: "dark" },
  { color: "#4A2010", key: "veryDark" },
] as const;

const HAIR_OPTIONS = [
  { value: "#4A2010", key: "darkStraight" },
  { value: "#8B4513", key: "brown" },
  { value: "#D4A017", key: "blond" },
  { value: "#FF6B6B", key: "red" },
  { value: "#6B7280", key: "grayHair" },
  { value: "#1A1A1A", key: "black" },
] as const;

const CLOTHES_OPTIONS = [
  { value: "#8B5CF6", key: "casual" }, // Violeta de marca
  { value: "#007BFF", key: "academic" },
  { value: "#28A745", key: "sport" },
  { value: "#6B7280", key: "formal" },
  { value: "#E83E8C", key: "creative" },
] as const;

const ACCESSORY_OPTIONS = [
  { value: "none", key: "none" },
  { value: "glasses", key: "glasses" },
  { value: "headphones", key: "headphones" },
  { value: "cap", key: "cap" },
  { value: "vr", key: "vr" },
] as const;

// [Config por defecto]: `Object.freeze` (JS) → inmutable; referencia estable para useLocalStorage
const DEFAULT_AVATAR: AvatarConfig = Object.freeze({
  skinColor: "#D4956A",
  eyeColor: "#6366F1",
  hairColor: "#4A2010",
  clothesColor: "#8B5CF6",
  accessory: "none",
});

const PRIMARY = "#6366F1"; // Índigo de marca (gorra / visor VR)
const PRIMARY_DARK = "#4F46E5";

// ── Avatar SVG (mismas formas que el original) ──
function HumanoidAvatar({ config }: { config: AvatarConfig }) {
  const armStyle = { animation: "nl-arm-bob 2.2s infinite" }; // Keyframes definidos en globals.css (se desactiva con prefers-reduced-motion)
  return (
    <svg viewBox="0 0 100 165" className="h-[145px] w-[88px]" style={{ filter: `drop-shadow(0 0 8px ${PRIMARY}33)` }} aria-hidden>
      {/* Cabeza + cabello */}
      <circle cx="50" cy="38" r="22" fill={config.skinColor} stroke={config.skinColor} strokeWidth="1.5" />
      <path d="M28 34 Q30 14 50 12 Q70 14 72 34 Q70 20 50 18 Q30 20 28 34 Z" fill={config.hairColor} />

      {/* Accesorio: gorra */}
      {config.accessory === "cap" && (
        <g>
          <ellipse cx="50" cy="22" rx="24" ry="8" fill={PRIMARY} />
          <path d="M26 22 Q26 10 50 8 Q74 10 74 22" fill={PRIMARY} />
          <rect x="26" y="20" width="48" height="6" rx="2" fill={PRIMARY_DARK} />
        </g>
      )}

      {/* Accesorio: casco VR (oculta los ojos) */}
      {config.accessory === "vr" && (
        <g>
          <rect x="30" y="26" width="40" height="20" rx="5" fill="#1A1A2E" stroke="#333" strokeWidth="1" />
          <rect x="32" y="28" width="36" height="16" rx="4" fill="#2A2A4E" />
          <line x1="50" y1="28" x2="50" y2="44" stroke="#444" strokeWidth="1" />
          <circle cx="42" cy="36" r="5" fill={PRIMARY} opacity="0.6" />
          <circle cx="58" cy="36" r="5" fill={PRIMARY} opacity="0.6" />
        </g>
      )}

      {config.accessory !== "vr" && (
        <>
          <circle cx="43" cy="36" r="3.5" fill={config.eyeColor} />
          <circle cx="57" cy="36" r="3.5" fill={config.eyeColor} />
        </>
      )}

      {/* Boca, cuello y cuerpo */}
      <path d="M44 48 Q50 53 56 48" fill="none" stroke="#7C3F1E" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="46" y="58" width="8" height="10" rx="3" fill={config.skinColor} />
      <path
        d="M30 76 Q28 98 29 112 L44 112 L45 90 L50 96 L55 90 L56 112 L71 112 Q72 98 70 76 Q61 68 50 67 Q39 68 30 76 Z"
        fill={config.clothesColor}
        stroke={config.clothesColor}
        strokeWidth="1"
      />

      {/* Brazos animados (desfase de 0.4s en el derecho) */}
      <path style={armStyle} d="M30 78 Q20 88 21 100 L27 99 Q27 88 35 80 Z" fill={config.clothesColor} />
      <path style={{ ...armStyle, animationDelay: "0.4s" }} d="M70 78 Q80 88 79 100 L73 99 Q73 88 65 80 Z" fill={config.clothesColor} />

      {/* Piernas */}
      <path d="M44 112 L42 148 L48 148 L50 128 L52 148 L58 148 L56 112 Z" fill="#1A1A2E" stroke="#333" strokeWidth="1" />

      {/* Accesorio: gafas */}
      {config.accessory === "glasses" && (
        <g>
          <rect x="37" y="30" width="26" height="10" rx="5" fill="#333" opacity="0.8" />
          <circle cx="43" cy="35" r="5" fill="none" stroke="#aaa" strokeWidth="1.5" />
          <circle cx="57" cy="35" r="5" fill="none" stroke="#aaa" strokeWidth="1.5" />
          <line x1="48" y1="35" x2="52" y2="35" stroke="#aaa" strokeWidth="1" />
        </g>
      )}

      {/* Accesorio: audífonos */}
      {config.accessory === "headphones" && (
        <g>
          <ellipse cx="24" cy="38" rx="4" ry="6" fill="#444" />
          <ellipse cx="76" cy="38" rx="4" ry="6" fill="#444" />
          <path d="M24 32 Q24 18 50 16 Q76 18 76 32" fill="none" stroke="#333" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

// [ColorSelector]: grupo de radios visuales (círculos de color) | [WAI-ARIA]: role="radiogroup" + aria-checked → navegable y anunciado
function ColorSelector({
  label,
  colors,
  selected,
  onChange,
  labelFor,
}: {
  label: string;
  colors: ReadonlyArray<{ color: string; key: string }>;
  selected: string;
  onChange: (color: string) => void;
  labelFor: (key: string) => string; // Traduce la clave de la opción
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="mb-[5px] text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-[5px]">
        {colors.map((opt) => {
          const isSelected = selected === opt.color;
          return (
            <button
              key={opt.color}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={labelFor(opt.key)}
              title={labelFor(opt.key)}
              onClick={() => onChange(opt.color)}
              className="size-[22px] cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              style={{
                background: opt.color,
                border: `2px solid ${isSelected ? opt.color : "var(--nl-brd)"}`,
                boxShadow: isSelected ? `0 0 5px ${opt.color}` : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// [OptionSelect]: <select> nativo etiquetado | `<T extends string>` (TS Generics): tipa el valor devuelto | [Principio]: DRY (3 selects iguales)
function OptionSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  labelFor,
}: {
  id: string;
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; key: string }>;
  onChange: (value: T) => void;
  labelFor: (key: string) => string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)} // `as T` (TS): el valor proviene de nuestras propias opciones
        className="control w-full bg-muted"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {labelFor(opt.key)}
          </option>
        ))}
      </select>
    </div>
  );
}

// `export function`: tarjeta derecha del perfil | `storageKey` incluye el id del usuario → cada cuenta tiene su avatar en el navegador
export function AvatarCard({ storageKey, badge }: { storageKey: string; badge: string }) {
  const { t } = usePreferences();
  const p = t.profile;
  const labelFor = (key: string) => p.options[key] ?? key; // `??` (ES2020): clave sin traducción → la clave cruda
  const [config, setConfig] = useLocalStorage<AvatarConfig>(storageKey, DEFAULT_AVATAR);
  const [saved, setSaved] = useState(false); // Confirmación visible tras "Guardar avatar"

  // [update]: mezcla parcial inmutable | `Partial<T>` (TS) + spread (ES2018) | persiste al instante (como el original)
  const update = (patch: Partial<AvatarConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  return (
    <section aria-labelledby="avatar-title" className="rounded-[14px] border border-border bg-card p-[18px] shadow-[var(--nl-shd)]">
      <h2 id="avatar-title" className="mb-1 text-sm font-bold">
        {p.avatarTitle}
      </h2>
      <p className="mb-3 text-[11px] leading-normal text-muted-foreground">{p.avatarIntro}</p>

      {/* [Responsive]: vista previa arriba en móvil muy estrecho, al lado desde 400px */}
      <div className="flex flex-col items-center gap-[14px] min-[400px]:flex-row min-[400px]:items-start">
        {/* Vista previa */}
        <div className="flex shrink-0 flex-col items-center gap-[5px]">
          <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted-foreground">{p.preview}</div>
          <div
            className="relative flex justify-center rounded-[10px] p-2.5"
            style={{ background: "#1E1B4B", border: `2px solid ${PRIMARY}44`, boxShadow: `0 0 20px ${PRIMARY}33, 0 4px 20px rgba(0,0,0,0.45)` }}
          >
            <HumanoidAvatar config={config} />
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gradient-brand px-2 py-0.5 font-mono text-[8px] font-bold text-white">
              {badge}
            </span>
          </div>
          <div className="max-w-[88px] text-center text-[9px] leading-tight text-muted-foreground">{p.localNote}</div>
        </div>

        {/* Selectores */}
        <div className="flex w-full flex-1 flex-col gap-[9px]">
          <ColorSelector label={p.eyes} colors={EYE_COLORS} selected={config.eyeColor} onChange={(c) => update({ eyeColor: c })} labelFor={labelFor} />
          <ColorSelector label={p.skin} colors={SKIN_COLORS} selected={config.skinColor} onChange={(c) => update({ skinColor: c })} labelFor={labelFor} />
          <OptionSelect id="avatar-hair" label={p.hair} value={config.hairColor} options={HAIR_OPTIONS} onChange={(v) => update({ hairColor: v })} labelFor={labelFor} />
          <OptionSelect id="avatar-clothes" label={p.clothes} value={config.clothesColor} options={CLOTHES_OPTIONS} onChange={(v) => update({ clothesColor: v })} labelFor={labelFor} />
          <OptionSelect<Accessory> id="avatar-accessory" label={p.accessory} value={config.accessory} options={ACCESSORY_OPTIONS} onChange={(v) => update({ accessory: v })} labelFor={labelFor} />
        </div>
      </div>

      {/* [2026-10-24]: un solo botón con la MISMA altura que «Guardar cambios» y «Cambiar contraseña» (tamaño md, antes btn-sm); «Ver progreso» sale de aquí (ya está arriba, junto al título) */}
      <div className="mt-[14px]">
        <button
          type="button"
          onClick={() => setSaved(true)} // Ya persistido en cada cambio; el botón confirma (mismo comportamiento del original)
          className="btn btn-primary w-full"
        >
          {p.saveAvatar}
        </button>
      </div>
      {/* [aria-live]: el lector de pantalla anuncia la confirmación */}
      <p role="status" aria-live="polite" className="mt-2 min-h-4 text-[11px] font-semibold text-primary">
        {saved ? p.avatarSaved : ""}
      </p>
    </section>
  );
}
