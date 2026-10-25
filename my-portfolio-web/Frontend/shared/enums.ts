// shared/enums.ts

// [SEGURIDAD] Portafolio personal: un único rol. No hay registro público ni USER.
export enum Role {
  ADMIN = 'admin',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export enum Language {
  SPANISH = 'es',
  ENGLISH = 'en',
}

export enum Section {
  HERO = 'Hero',
  ABOUT = 'About',
  PROJECTS = 'Projects',
  SKILLS = 'Skills',
  CONTACT = 'Contact',
}

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum ButtonVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  GHOST = 'ghost',
}

export enum IconSize {
  XS = 'xs',
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  XL = 'xl',
}
