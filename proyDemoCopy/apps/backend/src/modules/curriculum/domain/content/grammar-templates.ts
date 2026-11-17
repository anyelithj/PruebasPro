import { Language } from '../../../../shared/domain/language.vo'; // [Shared Kernel]: los 7 idiomas de la plataforma
// [Plantillas de gramática curadas · 2026-11-13 · Caso D · RNF-37]: reglas con ejemplos verificados en lugar de reglas libres de un modelo pequeño
// [Bug que corrige]: la IA publicó «a antes de consonantes sonoras / an antes de consonantes no sonoras» (falso: lo que decide es el SONIDO
// inicial de la palabra siguiente — a university, an hour) y ejemplos como «una paraguas».
// Se entregan como BORRADOR: igual que cualquier contenido sugerido, un docente lo revisa antes de publicarlo (ver publishSteps).
// [Patrón]: Registry (tema → idioma → reglas) + Lookup por coincidencia normalizada | [Principio]: datos curados (no inventados) + OCP (tema nuevo = entrada nueva)
// [Paradigma]: Declarativo (solo datos) + Funcional (búsqueda pura)

// `Readonly` + `as const` (TS): plantillas inmutables con la forma exacta del esquema GRAMMAR_RULE (title, structure, explanationEs, examples)
export interface GrammarTemplate {
  readonly title: string;
  readonly structure: string;
  readonly explanationEs: string;
  readonly examples: ReadonlyArray<{
    readonly text: string;
    readonly translationEs: string;
  }>;
}

const ex = (text: string, translationEs: string) => ({ text, translationEs }); // Helper puro: un ejemplo verificado

// ───── Artículos (A1) en los 7 idiomas ─────
const ARTICLES: Readonly<Record<Language, ReadonlyArray<GrammarTemplate>>> = {
  [Language.EN]: [
    {
      title: 'Artículo indefinido «a»',
      structure: 'a + palabra que empieza con SONIDO de consonante',
      explanationEs:
        'Usa «a» delante de un sustantivo singular contable cuando lo mencionas por primera vez o no es uno concreto. Lo que decide es el SONIDO inicial de la palabra siguiente, no la letra: se usa «a» ante sonido de consonante aunque la palabra se escriba con vocal (a university, a European city, a one-way ticket).',
      examples: [
        ex('a book', 'un libro'),
        ex('a university', 'una universidad'),
        ex('a European country', 'un país europeo'),
        ex('I have a dog.', 'Tengo un perro.'),
      ],
    },
    {
      title: 'Artículo indefinido «an»',
      structure: 'an + palabra que empieza con SONIDO de vocal',
      explanationEs:
        'Usa «an» cuando la palabra siguiente empieza con sonido de vocal, aunque se escriba con consonante: la «h» muda de hour u honest suena a vocal (an hour, an honest man). Es la misma regla que «a»; solo cambia para pronunciar con fluidez.',
      examples: [
        ex('an apple', 'una manzana'),
        ex('an hour', 'una hora'),
        ex('an umbrella', 'un paraguas'),
        ex('She is an engineer.', 'Ella es ingeniera.'),
      ],
    },
    {
      title: 'Artículo definido «the»',
      structure: 'the + sustantivo concreto (singular o plural)',
      explanationEs:
        'Usa «the» cuando hablas de algo concreto que el oyente puede identificar: porque ya se mencionó, porque es único o por el contexto. Sirve para singular y plural y no cambia con el género. No se usa para hablar de algo en general: «I like music» (no «the music»).',
      examples: [
        ex('the sun', 'el sol'),
        ex(
          'I bought a book. The book is great.',
          'Compré un libro. El libro es genial.',
        ),
        ex('the children', 'los niños'),
        ex('I like music.', 'Me gusta la música.'),
      ],
    },
  ],
  [Language.FR]: [
    {
      title: 'Artículos definidos: le, la, l’, les',
      structure:
        'le (masculino) · la (femenino) · l’ (ante vocal o h muda) · les (plural)',
      explanationEs:
        'Concuerdan en género y número con el sustantivo. Delante de vocal o de h muda, le y la se apostrofan: l’école, l’homme. En plural se usa les para los dos géneros.',
      examples: [
        ex('le livre', 'el libro'),
        ex('la maison', 'la casa'),
        ex('l’ami', 'el amigo'),
        ex('les enfants', 'los niños'),
      ],
    },
    {
      title: 'Artículos indefinidos: un, une, des',
      structure: 'un (masculino) · une (femenino) · des (plural)',
      explanationEs:
        'Presentan algo no concreto o mencionado por primera vez. A diferencia del español, el plural des es obligatorio: «J’ai des amis» (Tengo amigos). En la negación un, une y des pasan a de: «Je n’ai pas de voiture».',
      examples: [
        ex('un chien', 'un perro'),
        ex('une voiture', 'un auto'),
        ex('J’ai des amis.', 'Tengo amigos.'),
        ex('Je n’ai pas de voiture.', 'No tengo auto.'),
      ],
    },
    {
      title: 'Contracciones: au, aux, du, des',
      structure: 'à + le = au · à + les = aux · de + le = du · de + les = des',
      explanationEs:
        'Las preposiciones à y de se unen con le y les. Con la y l’ no hay contracción: à la plage, de l’école.',
      examples: [
        ex('Je vais au cinéma.', 'Voy al cine.'),
        ex('le livre du professeur', 'el libro del profesor'),
        ex('Je vais à la plage.', 'Voy a la playa.'),
      ],
    },
  ],
  [Language.DE]: [
    {
      title: 'Artículos definidos: der, die, das',
      structure:
        'der (masculino) · die (femenino) · das (neutro) · die (plural)',
      explanationEs:
        'Cada sustantivo tiene un género que se aprende con su artículo y no siempre coincide con el español (das Mädchen = la chica). En plural los tres géneros usan die. Estas son las formas del nominativo: cambian con el caso (den, dem, des…). Los sustantivos se escriben siempre con mayúscula.',
      examples: [
        ex('der Tisch', 'la mesa'),
        ex('die Lampe', 'la lámpara'),
        ex('das Buch', 'el libro'),
        ex('die Bücher', 'los libros'),
        ex('das Mädchen', 'la chica'),
      ],
    },
    {
      title: 'Artículos indefinidos: ein, eine',
      structure: 'ein (masculino y neutro) · eine (femenino) · sin plural',
      explanationEs:
        'En nominativo, ein va con masculino y neutro y eine con femenino. No tiene plural: «Ich habe Bücher» (Tengo libros). Para negar se usa kein / keine: «Ich habe kein Auto».',
      examples: [
        ex('ein Hund', 'un perro'),
        ex('eine Katze', 'un gato'),
        ex('ein Haus', 'una casa'),
        ex('Ich habe kein Auto.', 'No tengo auto.'),
      ],
    },
  ],
  [Language.PT]: [
    {
      title: 'Artículos definidos: o, a, os, as',
      structure: 'o (masculino) · a (femenino) · os / as (plural)',
      explanationEs:
        'Concuerdan en género y número con el sustantivo. Se contraen con las preposiciones: de + o = do, em + a = na, a + o = ao.',
      examples: [
        ex('o livro', 'el libro'),
        ex('a casa', 'la casa'),
        ex('os amigos', 'los amigos'),
        ex('Moro na cidade.', 'Vivo en la ciudad.'),
        ex('o carro do João', 'el auto de João'),
      ],
    },
    {
      title: 'Artículos indefinidos: um, uma, uns, umas',
      structure: 'um (masculino) · uma (femenino) · uns / umas (plural)',
      explanationEs:
        'Presentan algo no concreto o mencionado por primera vez. Concuerdan en género y número, igual que un, una, unos, unas en español.',
      examples: [
        ex('um gato', 'un gato'),
        ex('uma mesa', 'una mesa'),
        ex('uns livros', 'unos libros'),
      ],
    },
  ],
  [Language.ES]: [
    {
      title: 'Artículos determinados: el, la, los, las',
      structure: 'el (masculino) · la (femenino) · los / las (plural)',
      explanationEs:
        'Concuerdan en género y número con el sustantivo. Ante un sustantivo femenino que empieza por «a» o «ha» tónica se usa el en singular: el agua, el águila (pero las aguas). Se contraen: a + el = al, de + el = del.',
      examples: [
        ex('el libro', 'el libro'),
        ex('la casa', 'la casa'),
        ex('el agua fría', 'el agua fría'),
        ex('Voy al parque.', 'Voy al parque.'),
      ],
    },
    {
      title: 'Artículos indeterminados: un, una, unos, unas',
      structure: 'un (masculino) · una (femenino) · unos / unas (plural)',
      explanationEs:
        'Presentan algo no concreto o nuevo en la conversación. Con «a» tónica también se usa un en singular: un águila.',
      examples: [
        ex('un libro', 'un libro'),
        ex('una casa', 'una casa'),
        ex('unos amigos', 'unos amigos'),
      ],
    },
  ],
  [Language.RU]: [
    {
      title: 'El ruso no tiene artículos',
      structure: 'sustantivo sin artículo',
      explanationEs:
        'En ruso no existen equivalentes de el/la ni de un/una: «книга» puede ser «el libro» o «un libro» según el contexto. Lo conocido o lo nuevo se marca con el orden de las palabras o con palabras como этот (este).',
      examples: [
        ex('Это книга.', 'Esto es un libro.'),
        ex('Книга на столе.', 'El libro está sobre la mesa.'),
        ex('этот дом', 'esta casa'),
      ],
    },
  ],
  [Language.ZH]: [
    {
      title: 'El chino no tiene artículos',
      structure: '(número / 这 / 那) + clasificador + sustantivo',
      explanationEs:
        'En chino no hay artículos. Para contar o señalar algo concreto se pone un clasificador entre el número o el demostrativo y el sustantivo: 一本书 (un libro), 这个人 (esta persona). Sin número ni demostrativo, el contexto indica si es algo concreto.',
      examples: [
        ex('一本书', 'un libro'),
        ex('这个人', 'esta persona'),
        ex('我有一只猫。', 'Tengo un gato.'),
        ex('书在桌子上。', 'El libro está sobre la mesa.'),
      ],
    },
  ],
};

// [Registro de temas]: patrón del tema (normalizado, sin tildes) → plantillas por idioma | ponytail: un tema por ahora; añadir más temas aquí
const TOPICS: ReadonlyArray<{
  readonly match: RegExp;
  readonly rules: Readonly<Record<Language, ReadonlyArray<GrammarTemplate>>>;
}> = [
  { match: /(articul|article|artikel|artigo|артикл)/u, rules: ARTICLES }, // «Los artículos (a / an / the)», «Articles», «Die Artikel»…
];

// [plain]: sin tildes y en minúscula («Los Artículos» → «los articulos») | `normalize("NFD")` + `\p{M}` (Unicode): separa y quita las marcas
const plain = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// [curatedGrammar]: reglas curadas del tema en ese idioma; null si no hay plantilla (entonces el borrador lo propone la IA y pasa por revisión) | Función pura
export function curatedGrammar(
  language: Language,
  topic: string,
): ReadonlyArray<GrammarTemplate> | null {
  const hit = TOPICS.find((t) => t.match.test(plain(topic)));
  return hit?.rules[language] ?? null; // `?.` + `??` (ES2020)
}
