// Interfaces estrictas para datos y props

// shared/interfaces.ts

export interface Project {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  repoUrl?: string;
  liveDemoUrl?: string;
  image?: string;
  accessibilityLabel?: string; // Mejora para usuarios con lector de pantalla
}

export interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  icon?: string;
  accessibleLabel?: string;
}

export interface ContactForm {
  name: string;
  email: string;
  message: string;
}

export interface NavItem {
  label: string;
  section: string;
  icon?: string;
  ariaLabel?: string;
}
