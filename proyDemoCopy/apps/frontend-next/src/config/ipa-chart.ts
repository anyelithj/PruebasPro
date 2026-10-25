// [IPA_CHART · 2026-10-23]: alfabeto fonético del INGLÉS (44 fonemas, referencia británica RP con notas de EE. UU.) agrupado por temas, con palabra de ejemplo y la REGLA de cuándo se usa cada fonema (ortografía → sonido) | lo muestra Recursos › Pronunciación
// [Patrón]: Configuration Object (SSOT de datos estáticos) | [Principio]: SRP (solo datos, sin UI) + OCP (otro idioma = otro arreglo) | [Paradigma]: Declarativo
// [Tecnología]: TypeScript puro (`as const` + `readonly`) → se puede usar en RSC y en Client Components

import type { Language } from "@/types/quiz"; // `import type` (TS): solo el tipo, se borra al compilar

export interface Phoneme {
  readonly symbol: string; // Símbolo IPA (sin barras)
  readonly example: string; // Palabra de ejemplo (se pronuncia con el botón)
  readonly exampleIpa: string; // Transcripción de la palabra
  readonly spellings: string; // Grafías habituales que producen el sonido
  readonly ruleEs: string; // Cuándo se aplica (en español)
}

export interface PhonemeTopic {
  readonly id: string; // Ancla de la sección (#vocales-cortas)
  readonly title: string;
  readonly intro: string;
  readonly phonemes: readonly Phoneme[];
}

export const IPA_CHART_EN: readonly PhonemeTopic[] = [
  {
    id: "vocales-cortas",
    title: "Vocales cortas",
    intro: "Sonidos breves y relajados. Suelen ir en sílaba cerrada (vocal + consonante): sit, cat, hot.",
    phonemes: [
      { symbol: "ɪ", example: "sit", exampleIpa: "sɪt", spellings: "i, y, e (final -es/-ed)", ruleEs: "«i» corta en sílaba cerrada (sit, gym). Más abierta que la i española: la boca casi en «e»." },
      { symbol: "e", example: "bed", exampleIpa: "bed", spellings: "e, ea", ruleEs: "«e» en sílaba cerrada (bed) y «ea» en palabras como head, bread. En EE. UU. se transcribe /ɛ/." },
      { symbol: "æ", example: "cat", exampleIpa: "kæt", spellings: "a", ruleEs: "«a» en sílaba cerrada (cat, man). Entre la a y la e españolas, con la boca bien abierta." },
      { symbol: "ʌ", example: "cup", exampleIpa: "kʌp", spellings: "u, o, ou", ruleEs: "«u» en sílaba cerrada (cup, bus) y «o» en love, son, come. Como una «a» corta y relajada." },
      { symbol: "ɒ", example: "hot", exampleIpa: "hɒt", spellings: "o, a (tras w)", ruleEs: "«o» en sílaba cerrada en inglés británico (hot, dog) y «a» tras w (want, watch). En EE. UU. suena /ɑː/." },
      { symbol: "ʊ", example: "book", exampleIpa: "bʊk", spellings: "oo, u, ou", ruleEs: "«oo» delante de k/d (book, good) y «u» en put, full. Una «u» corta, sin redondear mucho los labios." },
      { symbol: "ə", example: "about", exampleIpa: "əˈbaʊt", spellings: "cualquier vocal átona", ruleEs: "Schwa: el sonido más frecuente del inglés. Cualquier vocal en sílaba SIN acento se reduce a /ə/ (about, banana, teacher)." },
    ],
  },
  {
    id: "vocales-largas",
    title: "Vocales largas",
    intro: "Se alargan (símbolo ː). Aparecen con dos vocales juntas o vocal + r.",
    phonemes: [
      { symbol: "iː", example: "see", exampleIpa: "siː", spellings: "ee, ea, e_e, ie", ruleEs: "Doble vocal «ee/ea» (see, sea) o «e» + consonante + «e» muda (these). Una «i» larga y tensa." },
      { symbol: "ɑː", example: "car", exampleIpa: "kɑː", spellings: "ar, a (UK: ask, bath)", ruleEs: "«ar» (car, park) y, en británico, «a» antes de s/th/f (ask, bath, after). En EE. UU. car = /kɑːr/." },
      { symbol: "ɔː", example: "door", exampleIpa: "dɔː", spellings: "or, oor, aw, au, al", ruleEs: "«or/oor» (door, sport), «aw/au» (saw, cause) y «al» + consonante (talk, walk)." },
      { symbol: "uː", example: "food", exampleIpa: "fuːd", spellings: "oo, u_e, ew, ue", ruleEs: "«oo» (food, moon), «u» + consonante + «e» (rule) y «ew/ue» (new, blue). Una «u» larga con labios redondeados." },
      { symbol: "ɜː", example: "bird", exampleIpa: "bɜːd", spellings: "ir, er, ur, ear, or (tras w)", ruleEs: "Vocal + r en sílaba acentuada: bird, her, turn, learn, work. En EE. UU. con r: /bɝːd/." },
    ],
  },
  {
    id: "diptongos",
    title: "Diptongos",
    intro: "Dos sonidos vocálicos en una sola sílaba: la lengua se desliza del primero al segundo.",
    phonemes: [
      { symbol: "eɪ", example: "day", exampleIpa: "deɪ", spellings: "a_e, ai, ay, ei", ruleEs: "«a» larga: a + consonante + «e» muda (make), «ai/ay» (rain, day) y «ei/ey» (eight, they)." },
      { symbol: "aɪ", example: "my", exampleIpa: "maɪ", spellings: "i_e, y, igh, ie", ruleEs: "«i» larga: i + consonante + «e» muda (time), «y» final (my), «igh» (night) e «ie» (pie)." },
      { symbol: "ɔɪ", example: "boy", exampleIpa: "bɔɪ", spellings: "oy, oi", ruleEs: "«oy» al final (boy, toy) y «oi» dentro de la palabra (coin, voice)." },
      { symbol: "əʊ", example: "go", exampleIpa: "ɡəʊ", spellings: "o_e, oa, ow, o final", ruleEs: "«o» larga: o + consonante + «e» (home), «oa» (boat), «ow» (snow) y «o» final (go). En EE. UU. /oʊ/." },
      { symbol: "aʊ", example: "now", exampleIpa: "naʊ", spellings: "ow, ou", ruleEs: "«ow» (now, cow) y «ou» (house, out). Como «au» española." },
      { symbol: "ɪə", example: "ear", exampleIpa: "ɪə", spellings: "ear, eer, ere", ruleEs: "Británico: «ear/eer/ere» (ear, beer, here). En EE. UU. se pronuncia la r: /ɪr/." },
      { symbol: "eə", example: "hair", exampleIpa: "heə", spellings: "air, are, ear", ruleEs: "Británico: «air/are» (hair, care) y bear, wear. En EE. UU. /er/." },
      { symbol: "ʊə", example: "tour", exampleIpa: "tʊə", spellings: "our, ure", ruleEs: "Poco frecuente y en retroceso: tour, pure. Muchos británicos dicen /ɔː/ (sure = /ʃɔː/)." },
    ],
  },
  {
    id: "oclusivas",
    title: "Consonantes oclusivas",
    intro: "Se cierra el paso del aire y se suelta de golpe. En pares sordo/sonoro (p/b, t/d, k/g).",
    phonemes: [
      { symbol: "p", example: "pen", exampleIpa: "pen", spellings: "p, pp", ruleEs: "Al inicio de sílaba acentuada lleva una pequeña aspiración (pʰen): suena con un soplo de aire." },
      { symbol: "b", example: "bag", exampleIpa: "bæɡ", spellings: "b, bb", ruleEs: "Siempre oclusiva (labios cerrados), también entre vocales: no se suaviza como la b española de «cabo»." },
      { symbol: "t", example: "tea", exampleIpa: "tiː", spellings: "t, tt, -ed (tras sordas)", ruleEs: "Aspirada al inicio (tʰiː). -ed suena /t/ tras sonidos sordos (walked). En EE. UU. entre vocales suena como r suave: water /ˈwɑːɾɚ/." },
      { symbol: "d", example: "dog", exampleIpa: "dɒɡ", spellings: "d, dd, -ed (tras sonoras)", ruleEs: "La lengua toca encima de los dientes (alvéolos). -ed suena /d/ tras sonidos sonoros (played) e /ɪd/ tras t/d (wanted)." },
      { symbol: "k", example: "key", exampleIpa: "kiː", spellings: "c, k, ck, ch, q", ruleEs: "«c» ante a/o/u (cat, cup), «k» ante e/i (key), «ck» tras vocal corta (back) y «ch» griego (school)." },
      { symbol: "ɡ", example: "game", exampleIpa: "ɡeɪm", spellings: "g, gg, gu", ruleEs: "«g» ante a/o/u (go, game); ante e/i a veces suena /dʒ/ (gym). Siempre oclusiva, también entre vocales." },
    ],
  },
  {
    id: "fricativas",
    title: "Consonantes fricativas",
    intro: "El aire sale rozando por un paso estrecho. Las sonoras vibran en la garganta.",
    phonemes: [
      { symbol: "f", example: "fish", exampleIpa: "fɪʃ", spellings: "f, ff, ph, gh", ruleEs: "«f/ph» (phone) y «gh» final en algunas palabras (laugh, enough)." },
      { symbol: "v", example: "van", exampleIpa: "væn", spellings: "v", ruleEs: "Dientes superiores sobre el labio inferior y la garganta vibra. NO es /b/: van ≠ ban." },
      { symbol: "θ", example: "think", exampleIpa: "θɪŋk", spellings: "th", ruleEs: "«th» en palabras de contenido (think, three, birthday). La lengua entre los dientes, como la «z» de España." },
      { symbol: "ð", example: "this", exampleIpa: "ðɪs", spellings: "th", ruleEs: "«th» en palabras gramaticales (the, this, that, they) y entre vocales (mother). Igual que /θ/ pero vibrando." },
      { symbol: "s", example: "sun", exampleIpa: "sʌn", spellings: "s, ss, c (ante e/i), -s (tras sordas)", ruleEs: "«c» ante e/i (city) y plural -s tras sonidos sordos (cats). Antes de consonante no se añade «e»: school, no «eschool»." },
      { symbol: "z", example: "zoo", exampleIpa: "zuː", spellings: "z, s (entre vocales), -s (tras sonoras)", ruleEs: "Plural/3.ª persona -s tras sonidos sonoros (dogs, plays) y s entre vocales (rose). Una «s» que zumba." },
      { symbol: "ʃ", example: "she", exampleIpa: "ʃiː", spellings: "sh, ti/ci (-tion, -cial), ch (francés)", ruleEs: "«sh» (she), terminaciones -tion/-cial (nation, special) y ch de origen francés (machine). Como pedir silencio: «shhh»." },
      { symbol: "ʒ", example: "vision", exampleIpa: "ˈvɪʒn", spellings: "s (-sion, -sure), g (francés)", ruleEs: "-sion tras vocal (vision), -sure (measure) y g francesa (garage). Como /ʃ/ pero vibrando." },
      { symbol: "h", example: "hat", exampleIpa: "hæt", spellings: "h, wh", ruleEs: "Solo un soplo suave (no la «j» española). Muda en hour, honest y a menudo en pronombres átonos (him, her)." },
    ],
  },
  {
    id: "africadas",
    title: "Consonantes africadas",
    intro: "Empiezan como oclusiva y terminan como fricativa (t+ʃ, d+ʒ).",
    phonemes: [
      { symbol: "tʃ", example: "chair", exampleIpa: "tʃeə", spellings: "ch, tch, t (-ture)", ruleEs: "«ch» (chair), «tch» tras vocal corta (watch) y -ture (picture). Como la «ch» española." },
      { symbol: "dʒ", example: "job", exampleIpa: "dʒɒb", spellings: "j, g (ante e/i/y), dge", ruleEs: "«j» (job), «g» ante e/i/y (gym, page) y «dge» tras vocal corta (bridge). Como /tʃ/ pero vibrando." },
    ],
  },
  {
    id: "nasales-liquidas",
    title: "Nasales y líquidas",
    intro: "El aire sale por la nariz (m, n, ŋ) o por los lados de la lengua (l, r).",
    phonemes: [
      { symbol: "m", example: "man", exampleIpa: "mæn", spellings: "m, mm, mb (final)", ruleEs: "Labios cerrados. En «-mb» final la b es muda (lamb, climb)." },
      { symbol: "n", example: "no", exampleIpa: "nəʊ", spellings: "n, nn, kn, gn", ruleEs: "«kn/gn» al inicio: la k y la g son mudas (know, gnome)." },
      { symbol: "ŋ", example: "sing", exampleIpa: "sɪŋ", spellings: "ng, n (ante k/g)", ruleEs: "«ng» final (sing, -ing): la g NO se pronuncia aparte. También «n» ante k/g (think, finger)." },
      { symbol: "l", example: "leg", exampleIpa: "leɡ", spellings: "l, ll", ruleEs: "Clara al inicio (leg) y «oscura» [ɫ] al final o ante consonante (ball, milk), con la lengua más atrás. Muda en walk, half." },
      { symbol: "r", example: "red", exampleIpa: "red", spellings: "r, rr, wr", ruleEs: "Sin vibrar ni tocar el paladar. Británico: solo se pronuncia ante vocal (red, but car = /kɑː/). EE. UU.: siempre (car /kɑːr/). Se transcribe /ɹ/ en fonética estrecha." },
    ],
  },
  {
    id: "semivocales",
    title: "Semivocales",
    intro: "Sonidos de paso hacia una vocal.",
    phonemes: [
      { symbol: "j", example: "yes", exampleIpa: "jes", spellings: "y, u (= /juː/)", ruleEs: "«y» inicial (yes, you) y la «u» que suena «iu» (use, music). Como la «i» de «hielo»." },
      { symbol: "w", example: "we", exampleIpa: "wiː", spellings: "w, wh, qu (= /kw/)", ruleEs: "«w/wh» (we, what) y «qu» = /kw/ (queen). Labios redondeados como para decir «u»." },
    ],
  },
];

// ───────────── [2026-10-23 · 4.º pase]: fonemas CLAVE de los otros seis idiomas (los que más cuestan a un hispanohablante) ─────────────
// Alimentan la lista «Tema *» de Recursos › Crear recurso › Pronunciación: cada opción es un fonema IPA y, al elegirlo, se muestra su regla
// ponytail: no es el inventario completo de cada lengua (el inglés sí tiene los 44); un docente nativo puede ampliar cada arreglo sin tocar la UI (OCP)
const t = (id: string, title: string, intro: string, phonemes: Phoneme[]): PhonemeTopic => ({ id, title, intro, phonemes }); // [Factory]: menos ruido al declarar

const IPA_CHART_FR: readonly PhonemeTopic[] = [
  t("fr-vocales", "Vocales orales y nasales", "El francés tiene vocales redondeadas y cuatro nasales que no existen en español.", [
    { symbol: "y", example: "tu", exampleIpa: "ty", spellings: "u, û", ruleEs: "La «u» francesa: lengua en posición de «i» y labios redondeados como para «u» (tu, rue)." },
    { symbol: "ø", example: "deux", exampleIpa: "dø", spellings: "eu, œu (sílaba abierta)", ruleEs: "«eu/œu» al final de sílaba o ante /z/ (deux, bleu, heureuse): una «e» con labios redondeados." },
    { symbol: "œ", example: "peur", exampleIpa: "pœʁ", spellings: "eu, œu + consonante", ruleEs: "«eu/œu» seguida de consonante pronunciada en la misma sílaba (peur, sœur): más abierta que /ø/." },
    { symbol: "ə", example: "le", exampleIpa: "lə", spellings: "e sin tilde", ruleEs: "«e» sin acento en sílaba abierta (le, petit). Muchas veces se omite al hablar: «sam(e)di»." },
    { symbol: "ɑ̃", example: "temps", exampleIpa: "tɑ̃", spellings: "an, am, en, em", ruleEs: "Vocal + n/m que NO va seguida de vocal ni de otra n/m (temps, chambre). La «n» no se pronuncia." },
    { symbol: "ɔ̃", example: "bon", exampleIpa: "bɔ̃", spellings: "on, om", ruleEs: "«on/om» ante consonante o al final (bon, nom). Si sigue vocal (bonne) deja de ser nasal." },
    { symbol: "ɛ̃", example: "vin", exampleIpa: "vɛ̃", spellings: "in, im, ain, ein, un", ruleEs: "«in/ain/ein» y, en el francés actual, también «un» (vin, pain, un) ante consonante o al final." },
  ]),
  t("fr-consonantes", "Consonantes", "Sonidos consonánticos propios del francés.", [
    { symbol: "ʁ", example: "rouge", exampleIpa: "ʁuʒ", spellings: "r, rr", ruleEs: "La «r» francesa se articula al fondo de la boca (úvula), nunca vibrante como la «rr» española." },
    { symbol: "ʒ", example: "je", exampleIpa: "ʒə", spellings: "j, g + e/i/y", ruleEs: "«j» siempre y «g» ante e, i, y (je, gens). Como la «sh» pero con vibración de la garganta." },
    { symbol: "ʃ", example: "chat", exampleIpa: "ʃa", spellings: "ch, sh", ruleEs: "«ch» (chat, chercher): nunca suena «ch» española /tʃ/." },
    { symbol: "ɲ", example: "montagne", exampleIpa: "mɔ̃taɲ", spellings: "gn", ruleEs: "«gn» = la «ñ» española (montagne, ligne)." },
    { symbol: "ɥ", example: "huit", exampleIpa: "ɥit", spellings: "u + vocal", ruleEs: "«u» seguida de vocal se desliza en una sola sílaba (huit, nuit, lui)." },
  ]),
];

const IPA_CHART_DE: readonly PhonemeTopic[] = [
  t("de-vocales", "Vocales y diptongos", "Las vocales alemanas son largas o cortas; la diéresis (Umlaut) cambia el sonido.", [
    { symbol: "yː", example: "über", exampleIpa: "ˈyːbɐ", spellings: "ü, üh, y", ruleEs: "«ü» larga en sílaba abierta o ante h (über, früh): «i» con labios redondeados." },
    { symbol: "øː", example: "schön", exampleIpa: "ʃøːn", spellings: "ö, öh", ruleEs: "«ö» larga (schön, Öl): «e» con labios redondeados." },
    { symbol: "ɛː", example: "Käse", exampleIpa: "ˈkɛːzə", spellings: "ä, äh", ruleEs: "«ä» larga (Käse, Mädchen): una «e» abierta y larga." },
    { symbol: "aɪ̯", example: "mein", exampleIpa: "maɪ̯n", spellings: "ei, ai", ruleEs: "«ei» se lee «ai» (mein, Wein). No confundir con «ie» = /iː/ (Liebe)." },
    { symbol: "ɔʏ̯", example: "heute", exampleIpa: "ˈhɔʏ̯tə", spellings: "eu, äu", ruleEs: "«eu/äu» suenan parecido a «oi» (heute, Häuser)." },
    { symbol: "ɐ", example: "Lehrer", exampleIpa: "ˈleːʁɐ", spellings: "-er final átono", ruleEs: "«-er» al final y sin acento se reduce a una «a» breve y oscura (Lehrer, Vater)." },
  ]),
  t("de-consonantes", "Consonantes", "Consonantes que se leen distinto que en español.", [
    { symbol: "ç", example: "ich", exampleIpa: "ɪç", spellings: "ch tras e, i, ä, ö, ü, ei, eu o consonante", ruleEs: "«ch» después de vocal anterior o de consonante (ich, Milch): un soplo suave con la lengua en «i»." },
    { symbol: "x", example: "Buch", exampleIpa: "buːx", spellings: "ch tras a, o, u, au", ruleEs: "«ch» después de vocal posterior (Buch, acht): como la «j» española." },
    { symbol: "ʃ", example: "Schule", exampleIpa: "ˈʃuːlə", spellings: "sch, s + p/t inicial", ruleEs: "«sch» siempre y «s» ante p/t al inicio de sílaba (Schule, Stadt, Sport)." },
    { symbol: "ts", example: "Zeit", exampleIpa: "tsaɪ̯t", spellings: "z, tz", ruleEs: "«z» y «tz» suenan «ts» (Zeit, Katze); nunca como la «z» española." },
    { symbol: "f", example: "Vater", exampleIpa: "ˈfaːtɐ", spellings: "f, v, ph", ruleEs: "«v» suena /f/ en palabras alemanas (Vater, viel); en préstamos suena /v/ (Vase)." },
    { symbol: "v", example: "Wasser", exampleIpa: "ˈvasɐ", spellings: "w", ruleEs: "«w» = /v/ con los dientes sobre el labio (Wasser, wie)." },
    { symbol: "t", example: "Hund", exampleIpa: "hʊnt", spellings: "d, t final", ruleEs: "Ensordecimiento final: b, d, g al final de sílaba suenan p, t, k (Hund, gelb, Tag)." },
  ]),
];

const IPA_CHART_ES: readonly PhonemeTopic[] = [
  t("es-consonantes", "Consonantes", "Cinco vocales puras; la dificultad está en algunas consonantes y en sus variantes suaves.", [
    { symbol: "β", example: "cabo", exampleIpa: "ˈkaβo", spellings: "b, v entre vocales", ruleEs: "«b» y «v» suenan IGUAL; entre vocales los labios no se cierran del todo (cabo, uva). Tras pausa o «m»: /b/ (vaso, ambos)." },
    { symbol: "ð", example: "dedo", exampleIpa: "ˈdeðo", spellings: "d entre vocales o final", ruleEs: "«d» entre vocales o al final es suave, con la lengua entre los dientes (dedo, verdad). Tras pausa, n o l: /d/." },
    { symbol: "ɣ", example: "lago", exampleIpa: "ˈlaɣo", spellings: "g + a/o/u entre vocales", ruleEs: "«g» suave entre vocales (lago, agua). Tras pausa o «n»: /g/ (gato, tengo)." },
    { symbol: "θ", example: "cielo", exampleIpa: "ˈθjelo", spellings: "c + e/i, z", ruleEs: "En España «ce, ci, z» = /θ/ (cielo, zapato). En América y Canarias suena /s/ (seseo)." },
    { symbol: "x", example: "jamón", exampleIpa: "xaˈmon", spellings: "j, g + e/i", ruleEs: "«j» siempre y «g» ante e, i (jamón, gente)." },
    { symbol: "ɾ", example: "pero", exampleIpa: "ˈpeɾo", spellings: "r entre vocales o final", ruleEs: "«r» simple: un solo toque de la lengua (pero, cantar)." },
    { symbol: "r", example: "perro", exampleIpa: "ˈpero", spellings: "rr, r inicial, r tras n/l/s", ruleEs: "«r» múltiple: vibra varias veces (perro, rosa, honra)." },
    { symbol: "ɲ", example: "niño", exampleIpa: "ˈniɲo", spellings: "ñ", ruleEs: "«ñ» (niño, año): la lengua se apoya en el paladar." },
    { symbol: "ʝ", example: "yo", exampleIpa: "ʝo", spellings: "y, ll (yeísmo)", ruleEs: "«y» y «ll» suenan igual en casi todo el mundo hispano (yo, llave). En el Río de la Plata: /ʃ/ o /ʒ/." },
  ]),
];

const IPA_CHART_PT: readonly PhonemeTopic[] = [
  t("pt-vocales", "Vocales abiertas y nasales", "El portugués distingue «e/o» abiertas y cerradas y tiene vocales nasales (referencia Brasil, con notas de Portugal).", [
    { symbol: "ɛ", example: "café", exampleIpa: "kaˈfɛ", spellings: "é, e tónica abierta", ruleEs: "«é» con tilde aguda siempre es abierta (café, pé). Diferencia significados: avô /o/ ≠ avó /ɔ/." },
    { symbol: "ɔ", example: "avó", exampleIpa: "aˈvɔ", spellings: "ó, o tónica abierta", ruleEs: "«ó» con tilde aguda es abierta (avó, só); «ô» es cerrada (avô)." },
    { symbol: "ɐ̃w̃", example: "pão", exampleIpa: "ˈpɐ̃w̃", spellings: "ão, -am átono", ruleEs: "«ão» y «-am» final (pão, falam): diptongo nasal, el aire sale también por la nariz." },
    { symbol: "ẽj̃", example: "bem", exampleIpa: "ˈbẽj̃", spellings: "-em, -ens", ruleEs: "«-em» final (bem, também) es un diptongo nasal; la «m» no se pronuncia." },
  ]),
  t("pt-consonantes", "Consonantes", "Consonantes del portugués que no existen o se escriben distinto en español.", [
    { symbol: "ɲ", example: "vinho", exampleIpa: "ˈviɲu", spellings: "nh", ruleEs: "«nh» = la «ñ» española (vinho, amanhã)." },
    { symbol: "ʎ", example: "filho", exampleIpa: "ˈfiʎu", spellings: "lh", ruleEs: "«lh» = la «ll» tradicional española, con la lengua en el paladar (filho, trabalho)." },
    { symbol: "ʒ", example: "janela", exampleIpa: "ʒaˈnɛlɐ", spellings: "j, g + e/i", ruleEs: "«j» siempre y «g» ante e, i (janela, gente): una «sh» sonora." },
    { symbol: "ʃ", example: "chave", exampleIpa: "ˈʃavi", spellings: "ch, x, s final (PT/RJ)", ruleEs: "«ch» y muchas «x» (chave, xícara). En Portugal y Río la «s» final también (mais)." },
    { symbol: "dʒ", example: "dia", exampleIpa: "ˈdʒiɐ", spellings: "d + i, d + e final átona (Brasil)", ruleEs: "En Brasil «d/t» ante /i/ suenan /dʒ/ y /tʃ/ (dia, tia, cidade). En Portugal: /d/, /t/." },
    { symbol: "h", example: "rato", exampleIpa: "ˈhatu", spellings: "r inicial, rr (Brasil)", ruleEs: "La «r» fuerte (inicial o «rr») suena como una «j» suave en Brasil (rato, carro); en Portugal, uvular /ʁ/." },
  ]),
];

const IPA_CHART_ZH: readonly PhonemeTopic[] = [
  t("zh-tonos", "Tonos", "El mandarín tiene cuatro tonos (y uno neutro): cambiar el tono cambia la palabra.", [
    { symbol: "˥", example: "mā (tono 1)", exampleIpa: "ma˥", spellings: "ā (1.er tono)", ruleEs: "Alto y sostenido, sin bajar (mā = mamá)." },
    { symbol: "˧˥", example: "má (tono 2)", exampleIpa: "ma˧˥", spellings: "á (2.º tono)", ruleEs: "Sube de medio a alto, como al preguntar «¿sí?» (má = cáñamo)." },
    { symbol: "˨˩˦", example: "mǎ (tono 3)", exampleIpa: "ma˨˩˦", spellings: "ǎ (3.er tono)", ruleEs: "Baja y vuelve a subir (mǎ = caballo). Ante otro 3.er tono se pronuncia como 2.º (nǐ hǎo → ní hǎo)." },
    { symbol: "˥˩", example: "mà (tono 4)", exampleIpa: "ma˥˩", spellings: "à (4.º tono)", ruleEs: "Cae con fuerza de alto a bajo, como una orden (mà = regañar)." },
  ]),
  t("zh-iniciales", "Iniciales (pinyin)", "Consonantes iniciales del pinyin que se leen distinto que en español.", [
    { symbol: "ʈʂ", example: "zhōng", exampleIpa: "ʈʂʊŋ˥", spellings: "zh", ruleEs: "«zh»: «ch» con la punta de la lengua doblada hacia atrás, sin aire (zhōng = medio)." },
    { symbol: "ʈʂʰ", example: "chī", exampleIpa: "ʈʂʰɻ̩˥", spellings: "ch", ruleEs: "«ch»: como «zh» pero con un soplo de aire (chī = comer)." },
    { symbol: "ʂ", example: "shū", exampleIpa: "ʂu˥", spellings: "sh", ruleEs: "«sh»: «sh» con la lengua doblada hacia atrás (shū = libro)." },
    { symbol: "ʐ", example: "rén", exampleIpa: "ʐən˧˥", spellings: "r", ruleEs: "«r» inicial: entre la «y» y la «r» inglesa, lengua doblada (rén = persona). Nunca vibrante." },
    { symbol: "tɕ", example: "jiā", exampleIpa: "tɕja˥", spellings: "j", ruleEs: "«j» (solo ante i, ü): «ch» suave con la lengua plana (jiā = casa). No es la «j» española." },
    { symbol: "tɕʰ", example: "qī", exampleIpa: "tɕʰi˥", spellings: "q", ruleEs: "«q» (solo ante i, ü): como «j» pero con soplo de aire (qī = siete)." },
    { symbol: "ɕ", example: "xiè", exampleIpa: "ɕjɛ˥˩", spellings: "x", ruleEs: "«x» (solo ante i, ü): una «s» con la lengua plana tocando el paladar (xièxie = gracias)." },
    { symbol: "tsʰ", example: "cài", exampleIpa: "tsʰaɪ˥˩", spellings: "c", ruleEs: "«c» = «ts» con soplo de aire (cài = plato, verdura)." },
    { symbol: "y", example: "lǜ", exampleIpa: "ly˥˩", spellings: "ü; u tras j, q, x, y", ruleEs: "«ü» (y la «u» después de j, q, x, y): «i» con labios redondeados (lǜ = verde, qù = ir)." },
  ]),
];

const IPA_CHART_RU: readonly PhonemeTopic[] = [
  t("ru-vocales", "Vocales y reducción", "Las vocales rusas cambian según el acento; la «ы» no existe en español.", [
    { symbol: "ɨ", example: "ты", exampleIpa: "tɨ", spellings: "ы", ruleEs: "«ы»: una «i» con la lengua retraída hacia atrás, labios sin redondear (ты = tú)." },
    { symbol: "ɐ", example: "молоко", exampleIpa: "məlɐˈko", spellings: "о, а átonas", ruleEs: "Akanye: la «о» sin acento suena «a» (justo antes de la sílaba tónica) o /ə/ (más lejos): молоко = «malakó»." },
    { symbol: "ɪ", example: "язык", exampleIpa: "jɪˈzɨk", spellings: "е, я átonas", ruleEs: "Ikanye: «е/я» sin acento se reducen a una «i» breve (язык, сестра)." },
  ]),
  t("ru-consonantes", "Consonantes", "Consonantes duras y blandas y sonidos sin equivalente en español.", [
    { symbol: "tʲ", example: "мать", exampleIpa: "matʲ", spellings: "consonante + ь, е, ё, и, ю, я", ruleEs: "Consonante blanda (palatalizada): la lengua sube hacia el paladar como para una «i» (мать = madre ≠ мат)." },
    { symbol: "ʂ", example: "шар", exampleIpa: "ʂar", spellings: "ш", ruleEs: "«ш»: «sh» siempre dura, con la lengua hacia atrás (шар = globo)." },
    { symbol: "ʐ", example: "жук", exampleIpa: "ʐuk", spellings: "ж", ruleEs: "«ж»: como «ш» pero sonora (жук = escarabajo)." },
    { symbol: "ɕː", example: "щи", exampleIpa: "ɕːi", spellings: "щ", ruleEs: "«щ»: «sh» larga y blanda, con la lengua plana (щи = sopa de col)." },
    { symbol: "x", example: "хлеб", exampleIpa: "xlʲep", spellings: "х", ruleEs: "«х» = la «j» española (хлеб = pan). Fíjate: la «б» final suena /p/." },
    { symbol: "ts", example: "царь", exampleIpa: "tsarʲ", spellings: "ц", ruleEs: "«ц» = «ts», siempre dura (царь = zar)." },
    { symbol: "p", example: "город", exampleIpa: "ˈɡorət", spellings: "б, в, г, д, ж, з finales", ruleEs: "Ensordecimiento final: las sonoras al final de palabra suenan sordas (хлеб → /p/, город → /t/)." },
  ]),
];

// [IPA_CHARTS]: tabla por idioma | `Readonly<Record<Language, …>>` (TS) → el compilador exige los siete idiomas | [Patrón]: Lookup Table
export const IPA_CHARTS: Readonly<Record<Language, readonly PhonemeTopic[]>> = { en: IPA_CHART_EN, fr: IPA_CHART_FR, de: IPA_CHART_DE, es: IPA_CHART_ES, pt: IPA_CHART_PT, zh: IPA_CHART_ZH, ru: IPA_CHART_RU };

// [phonemeTopic]: texto de la opción de la lista «Tema *» → «/ʃ/ · chat» | [Principio]: SSOT (el mismo texto sirve para buscar la regla)
export const phonemeTopic = (p: Phoneme): string => `/${p.symbol}/ · ${p.example}`;

// [findPhoneme]: tema elegido → fonema (para mostrar su regla bajo la lista) | `flatMap` (ES2019) + `find` | null si el tema no es un fonema
export const findPhoneme = (language: Language, topic: string): Phoneme | null =>
  IPA_CHARTS[language].flatMap((g) => g.phonemes).find((p) => phonemeTopic(p) === topic.trim()) ?? null;
