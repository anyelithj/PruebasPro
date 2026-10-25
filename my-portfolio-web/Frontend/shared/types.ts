// Tipos reutilizables para componentes o lógica

// shared/types.ts

export type ThemeMode = 'light' | 'dark' | 'system';
export type LanguageCode = 'es' | 'en';

export type SectionName =
  | 'Hero'
  | 'About'
  | 'Projects'
  | 'Skills'
  | 'Contact';

export type AccessibleKeyActions = {
  [key: string]: () => void;
};

export type FormValidationStatus = 'idle' | 'validating' | 'error' | 'success';
