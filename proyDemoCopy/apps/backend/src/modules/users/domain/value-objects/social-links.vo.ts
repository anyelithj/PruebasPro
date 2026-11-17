// [Redes sociales del docente · 2026-10-28]: regla ÚNICA de los enlaces públicos del perfil (LinkedIn, X/Twitter, Spotify, YouTube) | [Patrón]: Value Object (constantes + función pura de dominio) | [Principio]: SSOT + DRY (la usan el DTO de Mi perfil y el mapper del autor del curso) + OCP (nueva red = nueva entrada en SOCIAL_HOSTS) | [Paradigma]: Funcional + Declarativo
// [Espejo del frontend]: apps/frontend-next/src/types/profile.ts (SOCIAL_NETWORKS + isSocialUrl) valida con la MISMA regla en Zod antes de llamar al backend

// `as const` (TS): tupla de literales inmutable → tipo unión 'linkedin' | 'twitter' | 'spotify' | 'youtube'
export const SOCIAL_NETWORKS = [
  'linkedin',
  'twitter',
  'spotify',
  'youtube',
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]; // [Indexed access TS]: unión derivada de la tupla | [Principio]: DRY

// [Columna por red]: nombre de la propiedad en la entidad User (`linkedinUrl`…) | Template literal type (TS 4.1): `${N}Url` se calcula en compilación
export type SocialUrlField = `${SocialNetwork}Url`;
export const socialUrlField = (network: SocialNetwork): SocialUrlField =>
  `${network}Url`;

// [Dominios permitidos por red]: se acepta el dominio exacto o cualquier subdominio (www., m., open., co.…) | `Readonly<Record<…>>` (TS): tabla inmutable
// X conserva twitter.com (los enlaces antiguos siguen funcionando) · youtu.be = enlace corto oficial de YouTube
export const SOCIAL_HOSTS: Readonly<Record<SocialNetwork, readonly string[]>> =
  {
    linkedin: ['linkedin.com'],
    twitter: ['x.com', 'twitter.com'],
    spotify: ['spotify.com'],
    youtube: ['youtube.com', 'youtu.be'],
  };

// [Longitud de la columna]: coincide con `varchar(255)` de la migración UserSocialLinks1791993500000
export const SOCIAL_URL_MAX_LENGTH = 255;

// [isSocialUrl]: true si `value` es una URL https del dominio de esa red | `new URL()` (WHATWG URL API): parser estándar → sin regex frágiles
// [Seguridad]: solo `https:` (bloquea `javascript:`/`data:` en el href) · sin usuario/contraseña embebidos (phishing tipo https://linkedin.com@evil.tld)
export const isSocialUrl = (network: SocialNetwork, value: string): boolean => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      // `some` (ES5): basta un dominio permitido | `endsWith('.'+d)`: subdominio legítimo (no «evillinkedin.com»)
      SOCIAL_HOSTS[network].some((d) => host === d || host.endsWith(`.${d}`))
    );
  } catch {
    return false; // `new URL` lanza TypeError con texto que no es URL → inválida
  }
};

// [Nombre legible + mensaje de validación]: texto único por red (lo devuelve el DTO) | [Principio]: SSOT
export const SOCIAL_LABEL: Readonly<Record<SocialNetwork, string>> = {
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  spotify: 'Spotify',
  youtube: 'YouTube',
};
export const socialInvalidMessage = (network: SocialNetwork): string =>
  `Enlace de ${SOCIAL_LABEL[network]} no válido: usa https:// y el dominio ${SOCIAL_HOSTS[network].join(' o ')}.`;

// [SocialLinks]: forma pública de los enlaces (null = no configurado) | `Record<K, V>` (TS): un campo por red
export type SocialLinks = Record<SocialNetwork, string | null>;

// [socialLinksOf]: entidad (o cualquier objeto con las columnas) → SocialLinks | re-valida al leer → un valor antiguo/manipulado en BD nunca llega a un href | [Principio]: Defensa en profundidad
export const socialLinksOf = (
  source: Partial<Record<SocialUrlField, string | null>>,
): SocialLinks =>
  // `Object.fromEntries` (ES2019): [[clave, valor]] → objeto | `as SocialLinks`: TS no infiere claves literales desde `map`
  Object.fromEntries(
    SOCIAL_NETWORKS.map((n) => {
      const v = source[socialUrlField(n)]?.trim();
      return [n, v && isSocialUrl(n, v) ? v : null];
    }),
  ) as SocialLinks;
