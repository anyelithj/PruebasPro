// [Port AlignmentPort · shared/domain · Sprint 9.4]: inicio y fin de cada línea a partir del audio (FastAPI Alignment) sin que los casos de uso conozcan HTTP — lo usan Music (propone tiempos) y Dialogues (voz limpia) | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP + DRY (un solo cliente) | [Paradigma]: POO

export const ALIGNMENT = Symbol('ALIGNMENT');

// [Contratos]: espejo de AlignResponse de FastAPI (snake_case del cable)
export interface LineTiming {
  index: number;
  start: number | null;
  end: number | null;
  confidence: number; // 0–1: proporción de palabras de la línea reconocidas en el audio
}
export interface AlignmentResult {
  lines: LineTiming[];
  kind: 'dialogue' | 'song';
  proposed: boolean; // Canciones: solo propuesta (el docente decide en el editor)
  duration: number;
  model: string;
}

export interface AlignmentPort {
  align(
    input: {
      audio: Buffer;
      mime: string;
      lines: string[];
      language: string;
      kind: 'dialogue' | 'song';
    },
    token: string,
  ): Promise<AlignmentResult>;
}
