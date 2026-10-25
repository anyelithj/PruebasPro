// [Contenido de juegos · Sprints 8.5/8.17 · RF-100 a RF-104]: tarjetas, temas y frases ORIGINALES redactadas para Aula de Idiomas | [Patrón]: Registry (datos semilla en código) + Lookup Table por idioma | [Principio]: SSOT + cumplimiento de derechos de autor | [Paradigma]: Declarativo
// [Licencia]: CC BY 4.0 · © Aula de Idiomas · texto propio; el audio lo genera la voz local (espeak-ng / SpeechSynthesis) y las imágenes son emoji Unicode → sin fragmentos de películas ni material con derechos
// [Idiomas]: inglés completo; el resto usa su propio banco si existe y, si no, el inglés (se indica en `language` del contenido)

export const GAME_CONTENT_LICENSE = {
  license: 'CC BY 4.0',
  author: 'Aula de Idiomas',
  source: 'Contenido original del proyecto (sin material de terceros)',
} as const;

export interface TabooCard {
  target: string;
  forbidden: string[];
  emoji: string;
  category: string; // [Sprint 8.8]: categoría en el idioma de la tarjeta → «clasificación rápida» (quick_sort)
}

export interface ListeningLine {
  text: string;
  answer?: string; // quick_qa: respuesta esperada (palabra clave)
  // [2026-10-19 · quick_qa]: la PREGUNTA que se escucha tras la frase («How long…?») → antes solo sonaba la frase y el alumno no sabía qué dato pedían
  question?: string;
  gap?: string; // partial_dictation: palabra que se oculta
}

interface LanguageBank {
  taboo: TabooCard[];
  topics: string[]; // Debate, tema al azar e historia encadenada
  listening: ListeningLine[];
}

const EN: LanguageBank = {
  taboo: [
    {
      target: 'apple',
      forbidden: ['fruit', 'red', 'tree'],
      emoji: '🍎',
      category: 'food',
    },
    {
      target: 'airport',
      forbidden: ['plane', 'fly', 'travel'],
      emoji: '🛫',
      category: 'places',
    },
    {
      target: 'umbrella',
      forbidden: ['rain', 'wet', 'open'],
      emoji: '☂️',
      category: 'objects',
    },
    {
      target: 'doctor',
      forbidden: ['hospital', 'sick', 'medicine'],
      emoji: '🩺',
      category: 'people',
    },
    {
      target: 'kitchen',
      forbidden: ['cook', 'food', 'room'],
      emoji: '🍳',
      category: 'places',
    },
    {
      target: 'bicycle',
      forbidden: ['ride', 'wheels', 'pedal'],
      emoji: '🚲',
      category: 'objects',
    },
    {
      target: 'library',
      forbidden: ['books', 'read', 'quiet'],
      emoji: '📚',
      category: 'places',
    },
    {
      target: 'birthday',
      forbidden: ['cake', 'party', 'age'],
      emoji: '🎂',
      category: 'events',
    },
    {
      target: 'teacher',
      forbidden: ['school', 'class', 'student'],
      emoji: '🧑‍🏫',
      category: 'people',
    },
    {
      target: 'coffee',
      forbidden: ['drink', 'cup', 'morning'],
      emoji: '☕',
      category: 'food',
    },
  ],
  topics: [
    'Homework should be optional',
    'Cities are better than the countryside',
    'Everyone should learn a second language at school',
    'Social media does more good than harm',
    'Remote work is the future',
    'A weekend trip that went wrong',
    'The best meal you have ever eaten',
  ],
  listening: [
    {
      text: 'I usually take the bus to work at eight',
      gap: 'bus',
      answer: 'eight',
      question: 'What time do I take the bus?',
    },
    {
      text: 'She has been learning French for two years',
      gap: 'learning',
      answer: 'two years',
      question: 'How long has she been learning French?',
    },
    {
      text: 'Could you tell me where the station is',
      gap: 'station',
      answer: 'station',
      question: 'Which place is the person looking for?',
    },
    {
      text: 'We are going to visit our grandparents on Sunday',
      gap: 'visit',
      answer: 'Sunday',
      question: 'On which day are we visiting our grandparents?',
    },
    {
      text: 'The museum opens at ten and closes at six',
      gap: 'museum',
      answer: 'ten',
      question: 'What time does the museum open?',
    },
    {
      text: 'My brother is taller than my father',
      gap: 'taller',
      answer: 'brother',
      question: 'Who is taller than my father?',
    },
  ],
};

const ES: LanguageBank = {
  taboo: [
    {
      target: 'manzana',
      forbidden: ['fruta', 'roja', 'árbol'],
      emoji: '🍎',
      category: 'comida',
    },
    {
      target: 'aeropuerto',
      forbidden: ['avión', 'volar', 'viaje'],
      emoji: '🛫',
      category: 'lugares',
    },
    {
      target: 'paraguas',
      forbidden: ['lluvia', 'mojado', 'abrir'],
      emoji: '☂️',
      category: 'objetos',
    },
    {
      target: 'biblioteca',
      forbidden: ['libros', 'leer', 'silencio'],
      emoji: '📚',
      category: 'lugares',
    },
  ],
  topics: [
    'Los deberes deberían ser opcionales',
    'Un viaje que salió mal',
    'La mejor comida de mi vida',
  ],
  listening: [
    {
      text: 'Normalmente tomo el autobús a las ocho',
      gap: 'autobús',
      answer: 'ocho',
      question: '¿A qué hora tomo el autobús?',
    },
    {
      text: 'El museo abre a las diez y cierra a las seis',
      gap: 'museo',
      answer: 'diez',
      question: '¿A qué hora abre el museo?',
    },
  ],
};

const FR: LanguageBank = {
  taboo: [
    {
      target: 'pomme',
      forbidden: ['fruit', 'rouge', 'arbre'],
      emoji: '🍎',
      category: 'nourriture',
    },
    {
      target: 'aéroport',
      forbidden: ['avion', 'voler', 'voyage'],
      emoji: '🛫',
      category: 'lieux',
    },
    {
      target: 'parapluie',
      forbidden: ['pluie', 'mouillé', 'ouvrir'],
      emoji: '☂️',
      category: 'objets',
    },
  ],
  topics: [
    'Les devoirs devraient être facultatifs',
    'Un voyage qui a mal tourné',
  ],
  listening: [
    { text: 'Je prends le bus à huit heures', gap: 'bus', answer: 'huit', question: 'À quelle heure je prends le bus ?' },
    { text: 'Le musée ouvre à dix heures', gap: 'musée', answer: 'dix', question: 'À quelle heure ouvre le musée ?' },
  ],
};

const BANKS: Readonly<Record<string, LanguageBank>> = Object.freeze({
  en: EN,
  es: ES,
  fr: FR,
});

// [bankFor]: banco del idioma o, si aún no existe, el inglés (la UI lo avisa con `fallback`) | [Paradigma]: función pura
export const bankFor = (
  language: string,
): LanguageBank & { fallback: boolean } =>
  BANKS[language]
    ? { ...BANKS[language], fallback: false }
    : { ...EN, fallback: true };

// [pick]: elemento pseudoaleatorio con semilla opcional (pruebas deterministas) | `Math.random` solo si no hay semilla
export const pick = <T>(items: readonly T[], seed?: number): T =>
  items[Math.abs(seed ?? Math.floor(Math.random() * 1e9)) % items.length];
