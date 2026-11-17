// [IPA_PHONEME_DETAILS · 2026-10-27]: contenido AMPLIADO de cada fonema del inglés para la página de detalle /resources/fonema (Recursos › Pronunciación › tarjeta)
// cómo se coloca la boca, 10 palabras con IPA (RP británico) + traducción, frases de ejemplo, pares mínimos y errores típicos de hispanohablantes
// [Patrón]: Configuration Object (datos estáticos, SSOT junto a IPA_CHART_EN) | [Principio]: SRP (solo datos, sin UI) + OCP (otro idioma = otra tabla) | [Paradigma]: Declarativo
// [Por qué estático y no IA bajo demanda]: /curriculum/ai/content es solo para docentes (Roles TEACHER) y tarda segundos → el estudiante ve el detalle al instante y sin coste de CPU
// [IPA de las frases]: no se escribe a mano → <aula-ipa-text> (IpaTextHost) la calcula UK/US con traducción, igual que en el resto de fichas | [Principio]: DRY

import type { Language } from "@/types/quiz"; // `import type` (TS): solo el tipo, se borra al compilar

// `type` tupla (TS): [palabra, IPA sin barras, traducción] → declarar 440 palabras sin ruido de claves
export type DetailWord = readonly [text: string, ipa: string, translationEs: string];
// [frase, traducción]
export type DetailSentence = readonly [text: string, translationEs: string];
// [palabra con el fonema, su IPA, palabra contraste, su IPA] → «ship /ʃɪp/ ≠ sheep /ʃiːp/»
export type MinimalPair = readonly [a: string, aIpa: string, b: string, bIpa: string];

export interface PhonemeDetail {
  readonly mouthEs: string; // Posición de labios, lengua y mandíbula (+ si vibra la garganta)
  readonly words: readonly DetailWord[]; // 8–12 palabras con el sonido
  readonly sentences: readonly DetailSentence[]; // Frases donde se oye varias veces
  readonly pairs: readonly MinimalPair[]; // Pares mínimos (vacío si el inglés no tiene pares frecuentes, p. ej. /ʒ/ o /ə/)
  readonly mistakesEs: readonly string[]; // Errores típicos de hispanohablantes
}

// [d]: Factory corta para declarar cada fonema | [Patrón]: Factory Function
const d = (mouthEs: string, words: DetailWord[], sentences: DetailSentence[], pairs: MinimalPair[], mistakesEs: string[]): PhonemeDetail => ({ mouthEs, words, sentences, pairs, mistakesEs });

// `Readonly<Record<…>>` (TS): clave = símbolo IPA exacto de IPA_CHART_EN (p. ej. "ɡ" es U+0261, no la «g» latina)
const IPA_DETAILS_EN: Readonly<Record<string, PhonemeDetail>> = {
  // ─── Vocales cortas ───
  "ɪ": d(
    "Lengua alta y adelantada pero relajada; labios neutros, sin sonreír. Más corta y abierta que la «i» española: suena entre «i» y «e».",
    [["sit", "sɪt", "sentarse"], ["fish", "fɪʃ", "pez"], ["big", "bɪɡ", "grande"], ["milk", "mɪlk", "leche"], ["ship", "ʃɪp", "barco"], ["gym", "dʒɪm", "gimnasio"], ["busy", "ˈbɪzi", "ocupado"], ["women", "ˈwɪmɪn", "mujeres"], ["build", "bɪld", "construir"], ["live", "lɪv", "vivir"]],
    [["This fish is big.", "Este pez es grande."], ["Jim lives in a little city.", "Jim vive en una ciudad pequeña."], ["Is it his ship?", "¿Es su barco?"]],
    [["ship", "ʃɪp", "sheep", "ʃiːp"], ["live", "lɪv", "leave", "liːv"], ["sit", "sɪt", "seat", "siːt"], ["fill", "fɪl", "feel", "fiːl"]],
    ["Pronunciarla como la «i» española larga: ship suena como sheep (oveja).", "Alargarla: /ɪ/ siempre es breve y relajada."],
  ),
  e: d(
    "Boca medio abierta, lengua adelantada a media altura, labios relajados. Muy parecida a la «e» española, algo más abierta.",
    [["bed", "bed", "cama"], ["red", "red", "rojo"], ["pen", "pen", "bolígrafo"], ["egg", "eɡ", "huevo"], ["head", "hed", "cabeza"], ["bread", "bred", "pan"], ["friend", "frend", "amigo"], ["said", "sed", "dijo"], ["any", "ˈeni", "cualquier"], ["ten", "ten", "diez"]],
    [["Ten men went to bed.", "Diez hombres se fueron a la cama."], ["My friend said yes.", "Mi amigo dijo que sí."], ["Get some bread and eggs.", "Compra pan y huevos."]],
    [["bed", "bed", "bad", "bæd"], ["men", "men", "man", "mæn"], ["pen", "pen", "pan", "pæn"], ["said", "sed", "sad", "sæd"]],
    ["Leer «ea» siempre como /iː/: head, bread y ready llevan /e/.", "Confundirla con /æ/: men ≠ man."],
  ),
  "æ": d(
    "Mandíbula bien abierta, lengua baja y adelantada, comisuras algo tensas. Empieza a decir «e» y abre la boca hacia «a».",
    [["cat", "kæt", "gato"], ["hat", "hæt", "sombrero"], ["man", "mæn", "hombre"], ["bag", "bæɡ", "bolsa"], ["apple", "ˈæpl", "manzana"], ["black", "blæk", "negro"], ["hand", "hænd", "mano"], ["family", "ˈfæməli", "familia"], ["happy", "ˈhæpi", "feliz"], ["travel", "ˈtrævl", "viajar"]],
    [["The black cat sat on a mat.", "El gato negro se sentó en una alfombrilla."], ["Pack your bag, Sam.", "Haz tu maleta, Sam."], ["My family is happy.", "Mi familia está feliz."]],
    [["bad", "bæd", "bed", "bed"], ["man", "mæn", "men", "men"], ["cat", "kæt", "cut", "kʌt"], ["cap", "kæp", "cup", "kʌp"]],
    ["Pronunciarla como la «a» española: hat suena como hut.", "Cerrarla hacia «e»: bad suena como bed."],
  ),
  "ʌ": d(
    "Boca medio abierta y relajada, lengua en el centro, labios neutros (sin redondear). Como una «a» corta y apagada.",
    [["cup", "kʌp", "taza"], ["bus", "bʌs", "autobús"], ["sun", "sʌn", "sol"], ["love", "lʌv", "amor"], ["mother", "ˈmʌðə", "madre"], ["money", "ˈmʌni", "dinero"], ["young", "jʌŋ", "joven"], ["come", "kʌm", "venir"], ["but", "bʌt", "pero"], ["much", "mʌtʃ", "mucho"]],
    [["My mother loves the sun.", "A mi madre le encanta el sol."], ["Come on, run for the bus!", "¡Vamos, corre para alcanzar el autobús!"], ["I haven't got much money.", "No tengo mucho dinero."]],
    [["cup", "kʌp", "cap", "kæp"], ["cut", "kʌt", "cat", "kæt"], ["hut", "hʌt", "hot", "hɒt"], ["luck", "lʌk", "lock", "lɒk"]],
    ["Leer la «u» como «u» española: bus no es /bus/.", "Leer la «o» de love, son o come como «o»."],
  ),
  "ɒ": d(
    "Boca abierta, lengua baja y atrás, labios ligeramente redondeados. Una «o» muy breve y abierta (británico).",
    [["hot", "hɒt", "caliente"], ["dog", "dɒɡ", "perro"], ["box", "bɒks", "caja"], ["clock", "klɒk", "reloj"], ["shop", "ʃɒp", "tienda"], ["doctor", "ˈdɒktə", "médico"], ["watch", "wɒtʃ", "reloj de pulsera"], ["what", "wɒt", "qué"], ["want", "wɒnt", "querer"], ["often", "ˈɒfn", "a menudo"]],
    [["The dog is in the box.", "El perro está en la caja."], ["I often want hot chocolate.", "A menudo quiero chocolate caliente."], ["Tom got a job at the shop.", "Tom consiguió trabajo en la tienda."]],
    [["hot", "hɒt", "hat", "hæt"], ["cot", "kɒt", "caught", "kɔːt"], ["lock", "lɒk", "luck", "lʌk"], ["cod", "kɒd", "cord", "kɔːd"]],
    ["Pronunciarla como la «o» cerrada española.", "Mezclar acentos: en EE. UU. suena /ɑː/ (hot = /hɑːt/); elige uno y sé constante."],
  ),
  "ʊ": d(
    "Labios poco redondeados y relajados, lengua alta y atrás. Una «u» breve, sin tensar.",
    [["book", "bʊk", "libro"], ["good", "ɡʊd", "bueno"], ["foot", "fʊt", "pie"], ["look", "lʊk", "mirar"], ["cook", "kʊk", "cocinar"], ["put", "pʊt", "poner"], ["full", "fʊl", "lleno"], ["push", "pʊʃ", "empujar"], ["woman", "ˈwʊmən", "mujer"], ["could", "kʊd", "podría"]],
    [["Look at this good book.", "Mira este buen libro."], ["Put your foot on the floor.", "Pon el pie en el suelo."], ["The woman could cook well.", "La mujer sabía cocinar bien."]],
    [["full", "fʊl", "fool", "fuːl"], ["pull", "pʊl", "pool", "puːl"], ["look", "lʊk", "Luke", "luːk"]],
    ["Hacerla larga como /uː/: full suena como fool.", "Leer todas las «oo» igual: book lleva /ʊ/ pero food lleva /uː/."],
  ),
  "ə": d(
    "Todo relajado: boca entreabierta, lengua en reposo en el centro, labios neutros. Es un sonido breve, sin fuerza y nunca acentuado.",
    [["about", "əˈbaʊt", "sobre"], ["banana", "bəˈnɑːnə", "plátano"], ["teacher", "ˈtiːtʃə", "profesor"], ["sofa", "ˈsəʊfə", "sofá"], ["China", "ˈtʃaɪnə", "China"], ["today", "təˈdeɪ", "hoy"], ["doctor", "ˈdɒktə", "médico"], ["problem", "ˈprɒbləm", "problema"], ["second", "ˈsekənd", "segundo"], ["again", "əˈɡen", "otra vez"]],
    [["A banana for the teacher.", "Un plátano para el profesor."], ["Can you come again today?", "¿Puedes venir otra vez hoy?"], ["The doctor has a problem.", "El médico tiene un problema."]],
    [],
    ["Pronunciar cada vocal con su valor escrito: banana no es /banana/.", "Acentuar las palabras gramaticales: «to, for, a, of» suelen sonar /tə, fə, ə, əv/."],
  ),
  // ─── Vocales largas ───
  "iː": d(
    "Labios estirados como al sonreír, lengua alta, adelantada y tensa. Una «i» española, pero más larga.",
    [["see", "siː", "ver"], ["tea", "tiː", "té"], ["tree", "triː", "árbol"], ["green", "ɡriːn", "verde"], ["eat", "iːt", "comer"], ["sheep", "ʃiːp", "oveja"], ["key", "kiː", "llave"], ["people", "ˈpiːpl", "gente"], ["these", "ðiːz", "estos"], ["leave", "liːv", "irse"]],
    [["We eat cheese and drink tea.", "Comemos queso y bebemos té."], ["Please leave the key here.", "Por favor, deja la llave aquí."], ["The sheep sleep in the field.", "Las ovejas duermen en el campo."]],
    [["sheep", "ʃiːp", "ship", "ʃɪp"], ["leave", "liːv", "live", "lɪv"], ["seat", "siːt", "sit", "sɪt"], ["feel", "fiːl", "fill", "fɪl"]],
    ["Acortarla: leave suena como live.", "Creer que «ea» siempre es /iː/: también puede ser /e/ (bread) o /eɪ/ (great)."],
  ),
  "ɑː": d(
    "Boca muy abierta, lengua baja y atrás, labios relajados. Una «a» larga y profunda.",
    [["car", "kɑː", "coche"], ["park", "pɑːk", "parque"], ["father", "ˈfɑːðə", "padre"], ["start", "stɑːt", "empezar"], ["heart", "hɑːt", "corazón"], ["dark", "dɑːk", "oscuro"], ["garden", "ˈɡɑːdn", "jardín"], ["ask", "ɑːsk", "preguntar"], ["bath", "bɑːθ", "baño"], ["half", "hɑːf", "mitad"]],
    [["Park the car in the garden.", "Aparca el coche en el jardín."], ["My father starts at half past nine.", "Mi padre empieza a las nueve y media."], ["Ask Mark for a card.", "Pídele una tarjeta a Mark."]],
    [["heart", "hɑːt", "hut", "hʌt"], ["cart", "kɑːt", "cut", "kʌt"], ["barn", "bɑːn", "bun", "bʌn"], ["park", "pɑːk", "pack", "pæk"]],
    ["Pronunciar la «r» de car en británico: no suena si no le sigue una vocal.", "Hacerla corta: heart suena como hut."],
  ),
  "ɔː": d(
    "Labios redondeados y adelantados, lengua atrás a media altura, boca medio abierta. Una «o» larga.",
    [["door", "dɔː", "puerta"], ["four", "fɔː", "cuatro"], ["ball", "bɔːl", "pelota"], ["walk", "wɔːk", "caminar"], ["talk", "tɔːk", "hablar"], ["saw", "sɔː", "vi"], ["water", "ˈwɔːtə", "agua"], ["morning", "ˈmɔːnɪŋ", "mañana"], ["horse", "hɔːs", "caballo"], ["caught", "kɔːt", "atrapó"]],
    [["Close the door at four.", "Cierra la puerta a las cuatro."], ["We walk and talk every morning.", "Caminamos y hablamos cada mañana."], ["I saw a horse drink water.", "Vi a un caballo beber agua."]],
    [["caught", "kɔːt", "cot", "kɒt"], ["port", "pɔːt", "pot", "pɒt"], ["short", "ʃɔːt", "shot", "ʃɒt"], ["walk", "wɔːk", "work", "wɜːk"]],
    ["Pronunciar la «l» de walk y talk: es muda.", "Confundir walk /wɔːk/ con work /wɜːk/."],
  ),
  "uː": d(
    "Labios muy redondeados y adelantados, lengua alta, atrás y tensa. Una «u» larga.",
    [["food", "fuːd", "comida"], ["moon", "muːn", "luna"], ["blue", "bluː", "azul"], ["school", "skuːl", "escuela"], ["new", "njuː", "nuevo"], ["true", "truː", "verdadero"], ["fruit", "fruːt", "fruta"], ["shoe", "ʃuː", "zapato"], ["two", "tuː", "dos"], ["soup", "suːp", "sopa"]],
    [["Two blue shoes.", "Dos zapatos azules."], ["We eat fruit at noon.", "Comemos fruta al mediodía."], ["Is the news true?", "¿Es verdad la noticia?"]],
    [["fool", "fuːl", "full", "fʊl"], ["pool", "puːl", "pull", "pʊl"], ["Luke", "luːk", "look", "lʊk"]],
    ["Acortarla: pool suena como pull.", "Olvidar la /j/ de new, music o use: /njuː/, /ˈmjuːzɪk/, /juːz/."],
  ),
  "ɜː": d(
    "Labios neutros (ni sonrisa ni redondeo), lengua en el centro y boca medio abierta; mantén el sonido largo. No existe en español.",
    [["bird", "bɜːd", "pájaro"], ["her", "hɜː", "su (de ella)"], ["girl", "ɡɜːl", "chica"], ["work", "wɜːk", "trabajo"], ["learn", "lɜːn", "aprender"], ["first", "fɜːst", "primero"], ["turn", "tɜːn", "girar"], ["word", "wɜːd", "palabra"], ["early", "ˈɜːli", "temprano"], ["shirt", "ʃɜːt", "camisa"]],
    [["The girl learns a new word.", "La chica aprende una palabra nueva."], ["I work early on Thursday.", "Trabajo temprano el jueves."], ["Turn left at the church.", "Gira a la izquierda en la iglesia."]],
    [["work", "wɜːk", "walk", "wɔːk"], ["bird", "bɜːd", "bud", "bʌd"], ["hurt", "hɜːt", "hut", "hʌt"], ["firm", "fɜːm", "farm", "fɑːm"]],
    ["Leer la vocal escrita: girl no es «guirl» ni work «uork».", "Pronunciar una «r» fuerte en británico (en EE. UU. sí se oye una r suave: /bɝːd/)."],
  ),
  // ─── Diptongos ───
  "eɪ": d(
    "Empieza en una «e» media y desliza la lengua hacia arriba, hacia /ɪ/. Como la «ei» de «rey».",
    [["day", "deɪ", "día"], ["name", "neɪm", "nombre"], ["rain", "reɪn", "lluvia"], ["play", "pleɪ", "jugar"], ["make", "meɪk", "hacer"], ["eight", "eɪt", "ocho"], ["they", "ðeɪ", "ellos"], ["great", "ɡreɪt", "genial"], ["table", "ˈteɪbl", "mesa"], ["train", "treɪn", "tren"]],
    [["They play games every day.", "Juegan a juegos todos los días."], ["The train came late in the rain.", "El tren llegó tarde bajo la lluvia."], ["What's your name?", "¿Cómo te llamas?"]],
    [["late", "leɪt", "let", "let"], ["pain", "peɪn", "pen", "pen"], ["gate", "ɡeɪt", "get", "ɡet"], ["main", "meɪn", "men", "men"]],
    ["Leer la «a» de make o name como «a» española.", "No hacer el deslizamiento: late suena como let."],
  ),
  "aɪ": d(
    "Empieza con la boca abierta en «a» y cierra hacia /ɪ/. Como la «ai» de «aire».",
    [["my", "maɪ", "mi"], ["time", "taɪm", "tiempo"], ["night", "naɪt", "noche"], ["five", "faɪv", "cinco"], ["buy", "baɪ", "comprar"], ["fly", "flaɪ", "volar"], ["light", "laɪt", "luz"], ["nice", "naɪs", "agradable"], ["right", "raɪt", "correcto"], ["ice", "aɪs", "hielo"]],
    [["I like to fly at night.", "Me gusta volar de noche."], ["My bike is nice and white.", "Mi bici es bonita y blanca."], ["Is it five or nine?", "¿Son las cinco o las nueve?"]],
    [["light", "laɪt", "late", "leɪt"], ["bike", "baɪk", "bake", "beɪk"], ["buy", "baɪ", "boy", "bɔɪ"], ["time", "taɪm", "team", "tiːm"]],
    ["Leer la «i» de time como «i» española: time no es /tim/.", "Pronunciar la «gh» de night o light: es muda."],
  ),
  "ɔɪ": d(
    "Empieza con los labios redondeados en /ɔ/ y desliza hacia /ɪ/. Como la «oy» de «hoy».",
    [["boy", "bɔɪ", "niño"], ["toy", "tɔɪ", "juguete"], ["coin", "kɔɪn", "moneda"], ["voice", "vɔɪs", "voz"], ["oil", "ɔɪl", "aceite"], ["enjoy", "ɪnˈdʒɔɪ", "disfrutar"], ["noise", "nɔɪz", "ruido"], ["choice", "tʃɔɪs", "elección"], ["point", "pɔɪnt", "punto"], ["join", "dʒɔɪn", "unirse"]],
    [["The boy enjoys his new toy.", "El niño disfruta su juguete nuevo."], ["Don't make a noise!", "¡No hagas ruido!"], ["It's your choice.", "Es tu elección."]],
    [["boy", "bɔɪ", "buy", "baɪ"], ["oil", "ɔɪl", "aisle", "aɪl"], ["toy", "tɔɪ", "tie", "taɪ"], ["coin", "kɔɪn", "cane", "keɪn"]],
    ["Separarla en dos sílabas: boy tiene una sola.", "Confundirla con /aɪ/: toy ≠ tie."],
  ),
  "əʊ": d(
    "Empieza en schwa /ə/ (labios relajados) y termina redondeando los labios hacia /ʊ/. En EE. UU. empieza en «o»: /oʊ/.",
    [["go", "ɡəʊ", "ir"], ["home", "həʊm", "casa"], ["boat", "bəʊt", "barco"], ["snow", "snəʊ", "nieve"], ["phone", "fəʊn", "teléfono"], ["know", "nəʊ", "saber"], ["old", "əʊld", "viejo"], ["road", "rəʊd", "carretera"], ["open", "ˈəʊpən", "abrir"], ["slow", "sləʊ", "lento"]],
    [["Go home slowly in the snow.", "Ve a casa despacio en la nieve."], ["I know the old road.", "Conozco la carretera vieja."], ["Open the window, please.", "Abre la ventana, por favor."]],
    [["coat", "kəʊt", "caught", "kɔːt"], ["boat", "bəʊt", "bought", "bɔːt"], ["low", "ləʊ", "law", "lɔː"], ["woke", "wəʊk", "walk", "wɔːk"]],
    ["Pronunciarla como una «o» pura española.", "Confundir coat /kəʊt/ con caught /kɔːt/."],
  ),
  "aʊ": d(
    "Empieza con la boca abierta en «a» y termina redondeando los labios hacia /ʊ/. Como la «au» de «causa».",
    [["now", "naʊ", "ahora"], ["house", "haʊs", "casa"], ["out", "aʊt", "fuera"], ["cow", "kaʊ", "vaca"], ["mouth", "maʊθ", "boca"], ["down", "daʊn", "abajo"], ["town", "taʊn", "pueblo"], ["brown", "braʊn", "marrón"], ["flower", "ˈflaʊə", "flor"], ["about", "əˈbaʊt", "sobre"]],
    [["There's a brown cow outside the house.", "Hay una vaca marrón fuera de la casa."], ["Sit down now.", "Siéntate ahora."], ["The town has lots of flowers.", "El pueblo tiene muchas flores."]],
    [["now", "naʊ", "no", "nəʊ"], ["town", "taʊn", "tone", "təʊn"], ["loud", "laʊd", "load", "ləʊd"]],
    ["Leer «ou» u «ow» como «o»: town no es «ton».", "Confundir now /naʊ/ con know /nəʊ/."],
  ),
  "ɪə": d(
    "Empieza en /ɪ/ con la lengua alta y se desliza hacia el centro (schwa). En británico la r final no suena.",
    [["ear", "ɪə", "oreja"], ["here", "hɪə", "aquí"], ["beer", "bɪə", "cerveza"], ["near", "nɪə", "cerca"], ["year", "jɪə", "año"], ["clear", "klɪə", "claro"], ["idea", "aɪˈdɪə", "idea"], ["dear", "dɪə", "querido"], ["hear", "hɪə", "oír"], ["cheer", "tʃɪə", "animar"]],
    [["Come here, my dear.", "Ven aquí, querido."], ["I can hear you clearly.", "Te oigo claramente."], ["We meet here every year.", "Nos vemos aquí cada año."]],
    [["beer", "bɪə", "bear", "beə"], ["here", "hɪə", "hair", "heə"], ["ear", "ɪə", "air", "eə"], ["fear", "fɪə", "fair", "feə"]],
    ["Pronunciar la r final en británico (en EE. UU. sí: /hɪr/).", "Confundirla con /eə/: beer ≠ bear."],
  ),
  "eə": d(
    "Empieza en una «e» abierta y se relaja hacia el centro (schwa), sin r en británico.",
    [["hair", "heə", "pelo"], ["care", "keə", "cuidado"], ["chair", "tʃeə", "silla"], ["where", "weə", "dónde"], ["there", "ðeə", "allí"], ["bear", "beə", "oso"], ["wear", "weə", "llevar puesto"], ["square", "skweə", "cuadrado"], ["parents", "ˈpeərənts", "padres"], ["fair", "feə", "justo"]],
    [["Where is the chair?", "¿Dónde está la silla?"], ["Take care of your hair.", "Cuida tu pelo."], ["There's a bear over there.", "Hay un oso allí."]],
    [["hair", "heə", "here", "hɪə"], ["bear", "beə", "beer", "bɪə"], ["fair", "feə", "fear", "fɪə"], ["air", "eə", "ear", "ɪə"]],
    ["Leer «air» letra por letra: «a-i-r».", "Pronunciar la r final en británico (en EE. UU. sí: /her/)."],
  ),
  "ʊə": d(
    "Empieza en /ʊ/ con los labios algo redondeados y se relaja hacia el centro. Hoy muchos hablantes dicen simplemente /ɔː/.",
    [["tour", "tʊə", "gira"], ["pure", "pjʊə", "puro"], ["cure", "kjʊə", "curar"], ["sure", "ʃʊə", "seguro"], ["poor", "pʊə", "pobre"], ["jury", "ˈdʒʊəri", "jurado"], ["tourist", "ˈtʊərɪst", "turista"], ["during", "ˈdjʊərɪŋ", "durante"], ["plural", "ˈplʊərəl", "plural"], ["mature", "məˈtʃʊə", "maduro"]],
    [["Are you sure?", "¿Estás seguro?"], ["The tourist went on a tour.", "El turista hizo una visita guiada."], ["It is pure water.", "Es agua pura."]],
    [["tour", "tʊə", "tore", "tɔː"], ["sure", "ʃʊə", "shore", "ʃɔː"], ["poor", "pʊə", "pour", "pɔː"]],
    ["Pronunciar la r final en británico.", "Preocuparse de más: decir /ʃɔː/ para sure es la pronunciación moderna más común."],
  ),
  // ─── Oclusivas ───
  p: d(
    "Cierra los labios, acumula aire y suéltalo de golpe con un soplo (aspiración) al inicio de sílaba acentuada. La garganta no vibra.",
    [["pen", "pen", "bolígrafo"], ["park", "pɑːk", "parque"], ["paper", "ˈpeɪpə", "papel"], ["happy", "ˈhæpi", "feliz"], ["apple", "ˈæpl", "manzana"], ["stop", "stɒp", "parar"], ["cup", "kʌp", "taza"], ["open", "ˈəʊpən", "abrir"], ["pizza", "ˈpiːtsə", "pizza"], ["people", "ˈpiːpl", "gente"]],
    [["Peter likes pizza and apples.", "A Peter le gustan la pizza y las manzanas."], ["Please stop the bus.", "Por favor, para el autobús."], ["People play in the park.", "La gente juega en el parque."]],
    [["pen", "pen", "Ben", "ben"], ["pear", "peə", "bear", "beə"], ["pig", "pɪɡ", "big", "bɪɡ"], ["cap", "kæp", "cab", "kæb"]],
    ["No aspirarla: pen sin soplo suena como Ben a oídos nativos.", "Añadir una «e» delante de sp-: speak no es «espeak»."],
  ),
  b: d(
    "Labios cerrados; suelta el aire sin soplo y con vibración de la garganta. Los labios se cierran del todo, también entre vocales.",
    [["bag", "bæɡ", "bolsa"], ["big", "bɪɡ", "grande"], ["baby", "ˈbeɪbi", "bebé"], ["book", "bʊk", "libro"], ["bus", "bʌs", "autobús"], ["job", "dʒɒb", "trabajo"], ["rabbit", "ˈræbɪt", "conejo"], ["table", "ˈteɪbl", "mesa"], ["club", "klʌb", "club"], ["number", "ˈnʌmbə", "número"]],
    [["The baby has a big book.", "El bebé tiene un libro grande."], ["Bob takes the bus to his job.", "Bob toma el autobús para ir al trabajo."], ["There's a rabbit under the table.", "Hay un conejo debajo de la mesa."]],
    [["Ben", "ben", "pen", "pen"], ["big", "bɪɡ", "pig", "pɪɡ"], ["berry", "ˈberi", "very", "ˈveri"], ["cab", "kæb", "cap", "kæp"]],
    ["Suavizarla entre vocales como en «cabo»: rabbit lleva una /b/ firme.", "Confundir b y v: berry /b/ ≠ very /v/."],
  ),
  t: d(
    "La punta de la lengua toca los alvéolos (el borde detrás de los dientes de arriba), no los dientes. Al inicio de sílaba acentuada lleva un soplo.",
    [["tea", "tiː", "té"], ["ten", "ten", "diez"], ["time", "taɪm", "tiempo"], ["table", "ˈteɪbl", "mesa"], ["water", "ˈwɔːtə", "agua"], ["letter", "ˈletə", "carta"], ["hat", "hæt", "sombrero"], ["walked", "wɔːkt", "caminó"], ["street", "striːt", "calle"], ["tomato", "təˈmɑːtəʊ", "tomate"]],
    [["Tom wants tea at ten.", "Tom quiere té a las diez."], ["I walked down the street.", "Bajé caminando por la calle."], ["Write a letter to Tina.", "Escribe una carta a Tina."]],
    [["tie", "taɪ", "die", "daɪ"], ["ten", "ten", "den", "den"], ["write", "raɪt", "ride", "raɪd"], ["cart", "kɑːt", "card", "kɑːd"]],
    ["Apoyar la lengua en los dientes, como la t española.", "Leer -ed como /ed/: walked es /wɔːkt/, una sola sílaba."],
  ),
  d: d(
    "Punta de la lengua en los alvéolos; suelta el aire con vibración. Entre vocales sigue siendo firme, no como la «d» suave de «dedo».",
    [["dog", "dɒɡ", "perro"], ["day", "deɪ", "día"], ["door", "dɔː", "puerta"], ["red", "red", "rojo"], ["bed", "bed", "cama"], ["played", "pleɪd", "jugó"], ["dinner", "ˈdɪnə", "cena"], ["idea", "aɪˈdɪə", "idea"], ["window", "ˈwɪndəʊ", "ventana"], ["garden", "ˈɡɑːdn", "jardín"]],
    [["The dog is in the garden.", "El perro está en el jardín."], ["Dad played all day.", "Papá jugó todo el día."], ["Dinner is ready.", "La cena está lista."]],
    [["die", "daɪ", "tie", "taɪ"], ["den", "den", "ten", "ten"], ["ride", "raɪd", "write", "raɪt"], ["card", "kɑːd", "cart", "kɑːt"]],
    ["Suavizarla o perderla al final: bed no es «be».", "Leer played como /pleɪed/: es una sola sílaba, /pleɪd/."],
  ),
  k: d(
    "La parte de atrás de la lengua toca el velo del paladar y se suelta con un soplo al inicio de sílaba acentuada. La garganta no vibra.",
    [["key", "kiː", "llave"], ["cat", "kæt", "gato"], ["car", "kɑː", "coche"], ["cake", "keɪk", "pastel"], ["back", "bæk", "espalda"], ["school", "skuːl", "escuela"], ["kitchen", "ˈkɪtʃɪn", "cocina"], ["quick", "kwɪk", "rápido"], ["clock", "klɒk", "reloj"], ["chemistry", "ˈkemɪstri", "química"]],
    [["The cat is in the kitchen.", "El gato está en la cocina."], ["Kate bakes a cake.", "Kate hornea un pastel."], ["Come back quickly.", "Vuelve rápido."]],
    [["coat", "kəʊt", "goat", "ɡəʊt"], ["back", "bæk", "bag", "bæɡ"], ["cold", "kəʊld", "gold", "ɡəʊld"], ["curl", "kɜːl", "girl", "ɡɜːl"]],
    ["Pronunciar la k muda de know, knife o knee.", "Añadir una «e» inicial ante sc-/sk-: school no es «eschool»."],
  ),
  "ɡ": d(
    "La parte de atrás de la lengua contra el velo del paladar; suelta el aire con vibración. Cierra del todo, también entre vocales.",
    [["game", "ɡeɪm", "juego"], ["go", "ɡəʊ", "ir"], ["girl", "ɡɜːl", "chica"], ["big", "bɪɡ", "grande"], ["dog", "dɒɡ", "perro"], ["green", "ɡriːn", "verde"], ["bag", "bæɡ", "bolsa"], ["again", "əˈɡen", "otra vez"], ["guitar", "ɡɪˈtɑː", "guitarra"], ["egg", "eɡ", "huevo"]],
    [["The girl got a green bag.", "La chica consiguió una bolsa verde."], ["Let's play the game again.", "Juguemos otra vez."], ["Greg plays the guitar.", "Greg toca la guitarra."]],
    [["goat", "ɡəʊt", "coat", "kəʊt"], ["bag", "bæɡ", "back", "bæk"], ["gold", "ɡəʊld", "cold", "kəʊld"], ["girl", "ɡɜːl", "curl", "kɜːl"]],
    ["Suavizarla entre vocales como en «lago».", "Ensordecerla al final: bag suena como back."],
  ),
  // ─── Fricativas ───
  f: d(
    "Dientes de arriba apoyados suavemente en el labio inferior; el aire sale rozando, sin vibración.",
    [["fish", "fɪʃ", "pez"], ["five", "faɪv", "cinco"], ["phone", "fəʊn", "teléfono"], ["coffee", "ˈkɒfi", "café"], ["laugh", "lɑːf", "reír"], ["leaf", "liːf", "hoja"], ["family", "ˈfæməli", "familia"], ["photo", "ˈfəʊtəʊ", "foto"], ["off", "ɒf", "apagado"], ["enough", "ɪˈnʌf", "suficiente"]],
    [["Five fish for my family.", "Cinco peces para mi familia."], ["Turn off the phone.", "Apaga el teléfono."], ["Have you had enough coffee?", "¿Has tomado suficiente café?"]],
    [["fan", "fæn", "van", "væn"], ["few", "fjuː", "view", "vjuː"], ["leaf", "liːf", "leave", "liːv"], ["safe", "seɪf", "save", "seɪv"]],
    ["Pronunciar «gh» como /ɡ/: laugh y enough terminan en /f/.", "Confundirla con /v/ al final: leaf ≠ leave."],
  ),
  v: d(
    "Igual que /f/ (dientes de arriba sobre el labio inferior) pero haciendo vibrar la garganta.",
    [["van", "væn", "furgoneta"], ["very", "ˈveri", "muy"], ["voice", "vɔɪs", "voz"], ["seven", "ˈsevn", "siete"], ["love", "lʌv", "amor"], ["five", "faɪv", "cinco"], ["give", "ɡɪv", "dar"], ["river", "ˈrɪvə", "río"], ["visit", "ˈvɪzɪt", "visitar"], ["travel", "ˈtrævl", "viajar"]],
    [["I love to visit the river.", "Me encanta visitar el río."], ["Vicky has seven vans.", "Vicky tiene siete furgonetas."], ["Give me five.", "Choca esos cinco."]],
    [["van", "væn", "ban", "bæn"], ["very", "ˈveri", "berry", "ˈberi"], ["vote", "vəʊt", "boat", "bəʊt"], ["vest", "vest", "best", "best"]],
    ["Pronunciarla como /b/ (como en español): very suena como berry.", "Ensordecerla al final: five suena como «faif»."],
  ),
  "θ": d(
    "Punta de la lengua entre los dientes; el aire sale rozando, sin vibración. Como la «z» de «zapato» en España.",
    [["think", "θɪŋk", "pensar"], ["three", "θriː", "tres"], ["thank", "θæŋk", "agradecer"], ["bath", "bɑːθ", "baño"], ["mouth", "maʊθ", "boca"], ["birthday", "ˈbɜːθdeɪ", "cumpleaños"], ["Thursday", "ˈθɜːzdeɪ", "jueves"], ["tooth", "tuːθ", "diente"], ["nothing", "ˈnʌθɪŋ", "nada"], ["month", "mʌnθ", "mes"]],
    [["I think it's Thursday.", "Creo que es jueves."], ["Thank you for the three gifts.", "Gracias por los tres regalos."], ["My birthday is next month.", "Mi cumpleaños es el mes que viene."]],
    [["thin", "θɪn", "tin", "tɪn"], ["think", "θɪŋk", "sink", "sɪŋk"], ["three", "θriː", "tree", "triː"], ["mouth", "maʊθ", "mouse", "maʊs"]],
    ["Sustituirla por /t/ o /s/: three suena como tree y think como sink.", "Si en tu español no existe /θ/ (seseo), practica con la lengua visible entre los dientes."],
  ),
  "ð": d(
    "Como /θ/ (lengua entre los dientes) pero haciendo vibrar la garganta. Parecida a la «d» suave de «nada».",
    [["this", "ðɪs", "esto"], ["that", "ðæt", "eso"], ["the", "ðə", "el / la"], ["they", "ðeɪ", "ellos"], ["mother", "ˈmʌðə", "madre"], ["father", "ˈfɑːðə", "padre"], ["brother", "ˈbrʌðə", "hermano"], ["weather", "ˈweðə", "tiempo (clima)"], ["with", "wɪð", "con"], ["together", "təˈɡeðə", "juntos"]],
    [["This is my brother.", "Este es mi hermano."], ["They go there together.", "Van allí juntos."], ["Mother likes this weather.", "A mamá le gusta este tiempo."]],
    [["they", "ðeɪ", "day", "deɪ"], ["then", "ðen", "den", "den"], ["those", "ðəʊz", "doze", "dəʊz"], ["breathe", "briːð", "breeze", "briːz"]],
    ["Pronunciarla como una /d/ firme: they suena como day.", "Ensordecerla: the no es /θə/."],
  ),
  s: d(
    "Punta de la lengua cerca de los alvéolos; el aire sale por un canal estrecho, sin vibración.",
    [["sun", "sʌn", "sol"], ["six", "sɪks", "seis"], ["city", "ˈsɪti", "ciudad"], ["bus", "bʌs", "autobús"], ["class", "klɑːs", "clase"], ["cats", "kæts", "gatos"], ["snake", "sneɪk", "serpiente"], ["street", "striːt", "calle"], ["speak", "spiːk", "hablar"], ["nice", "naɪs", "agradable"]],
    [["Sam sees six snakes.", "Sam ve seis serpientes."], ["The city is nice in the sun.", "La ciudad es bonita con sol."], ["Speak slowly, please.", "Habla despacio, por favor."]],
    [["sip", "sɪp", "zip", "zɪp"], ["bus", "bʌs", "buzz", "bʌz"], ["price", "praɪs", "prize", "praɪz"], ["Sue", "suː", "zoo", "zuː"]],
    ["Añadir «e» ante s + consonante: speak, street y school no empiezan con «e».", "Pronunciar /s/ el plural de dogs o plays: ahí es /z/."],
  ),
  z: d(
    "Igual que /s/ pero haciendo vibrar la garganta: suena como el zumbido de una abeja.",
    [["zoo", "zuː", "zoológico"], ["zero", "ˈzɪərəʊ", "cero"], ["dogs", "dɒɡz", "perros"], ["plays", "pleɪz", "juega"], ["rose", "rəʊz", "rosa"], ["easy", "ˈiːzi", "fácil"], ["music", "ˈmjuːzɪk", "música"], ["busy", "ˈbɪzi", "ocupado"], ["nose", "nəʊz", "nariz"], ["is", "ɪz", "es"]],
    [["The zoo is busy today.", "El zoo está lleno hoy."], ["Music is easy for Zoe.", "La música es fácil para Zoe."], ["Those dogs have cold noses.", "Esos perros tienen la nariz fría."]],
    [["zip", "zɪp", "sip", "sɪp"], ["buzz", "bʌz", "bus", "bʌs"], ["prize", "praɪz", "price", "praɪs"], ["zoo", "zuː", "Sue", "suː"]],
    ["Pronunciarla como /s/ (el español no tiene /z/): zoo suena como Sue.", "Pronunciarla como la «z» de España /θ/."],
  ),
  "ʃ": d(
    "Labios adelantados y algo redondeados, lengua un poco más atrás que en /s/; el aire sale como al pedir silencio («shh»).",
    [["she", "ʃiː", "ella"], ["shoe", "ʃuː", "zapato"], ["fish", "fɪʃ", "pez"], ["ship", "ʃɪp", "barco"], ["nation", "ˈneɪʃn", "nación"], ["special", "ˈspeʃl", "especial"], ["sugar", "ˈʃʊɡə", "azúcar"], ["machine", "məˈʃiːn", "máquina"], ["wash", "wɒʃ", "lavar"], ["sure", "ʃɔː", "seguro"]],
    [["She sells shells.", "Ella vende conchas."], ["Wash your shoes.", "Lava tus zapatos."], ["I'm sure she's on the ship.", "Estoy seguro de que ella está en el barco."]],
    [["ship", "ʃɪp", "chip", "tʃɪp"], ["shoes", "ʃuːz", "choose", "tʃuːz"], ["wash", "wɒʃ", "watch", "wɒtʃ"], ["she", "ʃiː", "see", "siː"]],
    ["Pronunciarla como /tʃ/: ship suena como chip.", "Leer -tion como «ción»: nation es /ˈneɪʃn/."],
  ),
  "ʒ": d(
    "Igual que /ʃ/ (labios adelantados) pero haciendo vibrar la garganta. Como la «ll» rioplatense de «llave».",
    [["vision", "ˈvɪʒn", "visión"], ["television", "ˈtelɪvɪʒn", "televisión"], ["measure", "ˈmeʒə", "medir"], ["pleasure", "ˈpleʒə", "placer"], ["usually", "ˈjuːʒuəli", "normalmente"], ["garage", "ˈɡærɑːʒ", "garaje"], ["decision", "dɪˈsɪʒn", "decisión"], ["treasure", "ˈtreʒə", "tesoro"], ["Asia", "ˈeɪʒə", "Asia"], ["casual", "ˈkæʒuəl", "informal"]],
    [["It's a pleasure.", "Es un placer."], ["I usually watch television.", "Normalmente veo la televisión."], ["We found treasure in the garage.", "Encontramos un tesoro en el garaje."]],
    [],
    ["Pronunciarla como /s/ o /tʃ/: television no se dice como en español.", "Leer la «s» de -sure como /s/: measure es /ˈmeʒə/."],
  ),
  h: d(
    "Solo un soplo de aire suave desde la garganta, con la boca ya colocada para la vocal siguiente.",
    [["hat", "hæt", "sombrero"], ["house", "haʊs", "casa"], ["happy", "ˈhæpi", "feliz"], ["hello", "həˈləʊ", "hola"], ["hand", "hænd", "mano"], ["who", "huː", "quién"], ["hot", "hɒt", "caliente"], ["behind", "bɪˈhaɪnd", "detrás"], ["hospital", "ˈhɒspɪtl", "hospital"], ["whole", "həʊl", "entero"]],
    [["Hello, how are you?", "Hola, ¿cómo estás?"], ["Hold my hand, Helen.", "Toma mi mano, Helen."], ["Who is behind the house?", "¿Quién está detrás de la casa?"]],
    [["hat", "hæt", "at", "æt"], ["heat", "hiːt", "eat", "iːt"], ["hair", "heə", "air", "eə"], ["hold", "həʊld", "old", "əʊld"]],
    ["Pronunciarla como la «j» española, áspera: hello no es «jelou».", "Omitirla: hair suena como air. Ojo: es muda en hour, honest y honour."],
  ),
  // ─── Africadas ───
  "tʃ": d(
    "Empieza como /t/ (lengua en los alvéolos) y se suelta en /ʃ/ con los labios algo adelantados. Como la «ch» española.",
    [["chair", "tʃeə", "silla"], ["cheese", "tʃiːz", "queso"], ["church", "tʃɜːtʃ", "iglesia"], ["watch", "wɒtʃ", "reloj de pulsera"], ["kitchen", "ˈkɪtʃɪn", "cocina"], ["picture", "ˈpɪktʃə", "imagen"], ["teacher", "ˈtiːtʃə", "profesor"], ["lunch", "lʌntʃ", "almuerzo"], ["choose", "tʃuːz", "elegir"], ["much", "mʌtʃ", "mucho"]],
    [["The teacher eats cheese for lunch.", "El profesor come queso en el almuerzo."], ["Choose a chair.", "Elige una silla."], ["Look at the picture in the kitchen.", "Mira la imagen de la cocina."]],
    [["chip", "tʃɪp", "ship", "ʃɪp"], ["watch", "wɒtʃ", "wash", "wɒʃ"], ["cheap", "tʃiːp", "jeep", "dʒiːp"], ["chin", "tʃɪn", "gin", "dʒɪn"]],
    ["Pronunciarla como /ʃ/: chair suena como share.", "Leer -ture como «tur»: picture es /ˈpɪktʃə/."],
  ),
  "dʒ": d(
    "Como /tʃ/ pero con vibración de la garganta: la lengua en los alvéolos se suelta en /ʒ/.",
    [["job", "dʒɒb", "trabajo"], ["jam", "dʒæm", "mermelada"], ["juice", "dʒuːs", "zumo"], ["gym", "dʒɪm", "gimnasio"], ["page", "peɪdʒ", "página"], ["bridge", "brɪdʒ", "puente"], ["orange", "ˈɒrɪndʒ", "naranja"], ["June", "dʒuːn", "junio"], ["age", "eɪdʒ", "edad"], ["giraffe", "dʒəˈrɑːf", "jirafa"]],
    [["John drinks orange juice.", "John bebe zumo de naranja."], ["Jane goes to the gym in June.", "Jane va al gimnasio en junio."], ["Turn the page.", "Pasa la página."]],
    [["jeep", "dʒiːp", "cheap", "tʃiːp"], ["gin", "dʒɪn", "chin", "tʃɪn"], ["joke", "dʒəʊk", "yolk", "jəʊk"], ["Jess", "dʒes", "yes", "jes"]],
    ["Pronunciarla como la «j» española /x/ o como «y»: job no se dice con jota.", "Leer la «g» ante e/i como /ɡ/: gym, page y orange llevan /dʒ/."],
  ),
  // ─── Nasales y líquidas ───
  m: d(
    "Labios cerrados; el aire sale por la nariz y la garganta vibra.",
    [["man", "mæn", "hombre"], ["mother", "ˈmʌðə", "madre"], ["milk", "mɪlk", "leche"], ["money", "ˈmʌni", "dinero"], ["home", "həʊm", "casa"], ["summer", "ˈsʌmə", "verano"], ["lamb", "læm", "cordero"], ["climb", "klaɪm", "escalar"], ["room", "ruːm", "habitación"], ["name", "neɪm", "nombre"]],
    [["My mum is at home.", "Mi madre está en casa."], ["We climb the mountain in summer.", "Subimos la montaña en verano."], ["What's the man's name?", "¿Cómo se llama el hombre?"]],
    [["map", "mæp", "nap", "næp"], ["mice", "maɪs", "nice", "naɪs"], ["some", "sʌm", "sun", "sʌn"], ["mine", "maɪn", "nine", "naɪn"]],
    ["Pronunciar la b de -mb: lamb y climb terminan en /m/.", "Cambiar la /m/ final por /n/: some suena como sun."],
  ),
  n: d(
    "La punta de la lengua toca los alvéolos y el aire sale por la nariz.",
    [["no", "nəʊ", "no"], ["nine", "naɪn", "nueve"], ["name", "neɪm", "nombre"], ["nose", "nəʊz", "nariz"], ["sun", "sʌn", "sol"], ["ten", "ten", "diez"], ["know", "nəʊ", "saber"], ["knife", "naɪf", "cuchillo"], ["dinner", "ˈdɪnə", "cena"], ["window", "ˈwɪndəʊ", "ventana"]],
    [["Nine new names.", "Nueve nombres nuevos."], ["I know Nina.", "Conozco a Nina."], ["Dinner is at ten.", "La cena es a las diez."]],
    [["nap", "næp", "map", "mæp"], ["sun", "sʌn", "sung", "sʌŋ"], ["thin", "θɪn", "thing", "θɪŋ"], ["ran", "ræn", "rang", "ræŋ"]],
    ["Pronunciar la k o la g iniciales de know, knife o gnome: son mudas.", "Convertir la /n/ final en /ŋ/: thin ≠ thing."],
  ),
  "ŋ": d(
    "La parte de atrás de la lengua toca el velo del paladar (como en /k/) y el aire sale por la nariz. Como la «n» de «tengo».",
    [["sing", "sɪŋ", "cantar"], ["song", "sɒŋ", "canción"], ["long", "lɒŋ", "largo"], ["ring", "rɪŋ", "anillo"], ["think", "θɪŋk", "pensar"], ["thank", "θæŋk", "agradecer"], ["finger", "ˈfɪŋɡə", "dedo"], ["king", "kɪŋ", "rey"], ["morning", "ˈmɔːnɪŋ", "mañana"], ["English", "ˈɪŋɡlɪʃ", "inglés"]],
    [["The king is singing a song.", "El rey está cantando una canción."], ["Thank you for the ring.", "Gracias por el anillo."], ["I'm reading in the morning.", "Estoy leyendo por la mañana."]],
    [["thing", "θɪŋ", "thin", "θɪn"], ["rang", "ræŋ", "ran", "ræn"], ["sing", "sɪŋ", "sin", "sɪn"], ["wing", "wɪŋ", "win", "wɪn"]],
    ["Añadir una /ɡ/ al final: sing es /sɪŋ/, no «sing-g».", "Pronunciar -ing como «in»: morning es /ˈmɔːnɪŋ/."],
  ),
  l: d(
    "Punta de la lengua en los alvéolos. Al final de palabra o ante consonante (ball, milk) es «oscura» [ɫ]: la parte de atrás de la lengua sube.",
    [["leg", "leɡ", "pierna"], ["light", "laɪt", "luz"], ["love", "lʌv", "amor"], ["hello", "həˈləʊ", "hola"], ["ball", "bɔːl", "pelota"], ["milk", "mɪlk", "leche"], ["little", "ˈlɪtl", "pequeño"], ["apple", "ˈæpl", "manzana"], ["full", "fʊl", "lleno"], ["yellow", "ˈjeləʊ", "amarillo"]],
    [["Lily likes yellow lemons.", "A Lily le gustan los limones amarillos."], ["Fill the bottle with milk.", "Llena la botella de leche."], ["Hello, Lola!", "¡Hola, Lola!"]],
    [["light", "laɪt", "right", "raɪt"], ["long", "lɒŋ", "wrong", "rɒŋ"], ["lead", "liːd", "read", "riːd"], ["fly", "flaɪ", "fry", "fraɪ"]],
    ["Pronunciar la l muda de walk, talk, half o could.", "Hacer siempre la l clara del español: en ball y milk suena más grave."],
  ),
  r: d(
    "La lengua se curva hacia atrás sin tocar el paladar y los labios se redondean un poco. No vibra.",
    [["red", "red", "rojo"], ["rain", "reɪn", "lluvia"], ["right", "raɪt", "correcto"], ["room", "ruːm", "habitación"], ["very", "ˈveri", "muy"], ["sorry", "ˈsɒri", "lo siento"], ["carry", "ˈkæri", "llevar"], ["write", "raɪt", "escribir"], ["around", "əˈraʊnd", "alrededor"], ["three", "θriː", "tres"]],
    [["Robert ran in the rain.", "Robert corrió bajo la lluvia."], ["I'm very sorry.", "Lo siento mucho."], ["Write the right answer.", "Escribe la respuesta correcta."]],
    [["right", "raɪt", "light", "laɪt"], ["wrong", "rɒŋ", "long", "lɒŋ"], ["read", "riːd", "lead", "liːd"], ["fry", "fraɪ", "fly", "flaɪ"]],
    ["Hacerla vibrar como la «r» o la «rr» españolas.", "Pronunciar la w de wr- (write empieza por /r/) o, en británico, la r sin vocal detrás (car = /kɑː/)."],
  ),
  // ─── Semivocales ───
  j: d(
    "Lengua alta y adelantada como para decir «i», y se desliza enseguida a la vocal siguiente. Como la «i» de «hielo».",
    [["yes", "jes", "sí"], ["you", "juː", "tú"], ["yellow", "ˈjeləʊ", "amarillo"], ["year", "jɪə", "año"], ["young", "jʌŋ", "joven"], ["music", "ˈmjuːzɪk", "música"], ["use", "juːz", "usar"], ["new", "njuː", "nuevo"], ["beautiful", "ˈbjuːtɪfl", "bonito"], ["university", "ˌjuːnɪˈvɜːsəti", "universidad"]],
    [["Yes, you can use it.", "Sí, puedes usarlo."], ["The young girl loves music.", "A la chica joven le encanta la música."], ["Happy New Year!", "¡Feliz Año Nuevo!"]],
    [["yes", "jes", "Jess", "dʒes"], ["yolk", "jəʊk", "joke", "dʒəʊk"], ["year", "jɪə", "ear", "ɪə"], ["yet", "jet", "jet", "dʒet"]],
    ["Pronunciarla como /dʒ/ o como la «y» rehilada: yes no es «jes» ni «shes».", "Olvidarla en use, music o new: /juːz/, /ˈmjuːzɪk/, /njuː/."],
  ),
  w: d(
    "Labios redondeados y adelantados como para «u»; se abren rápido hacia la vocal. El labio no toca los dientes.",
    [["we", "wiː", "nosotros"], ["water", "ˈwɔːtə", "agua"], ["window", "ˈwɪndəʊ", "ventana"], ["one", "wʌn", "uno"], ["what", "wɒt", "qué"], ["week", "wiːk", "semana"], ["queen", "kwiːn", "reina"], ["sweet", "swiːt", "dulce"], ["wine", "waɪn", "vino"], ["wood", "wʊd", "madera"]],
    [["We want water.", "Queremos agua."], ["What's the weather like this week?", "¿Qué tiempo hace esta semana?"], ["The queen likes sweet wine.", "A la reina le gusta el vino dulce."]],
    [["wine", "waɪn", "vine", "vaɪn"], ["west", "west", "vest", "vest"], ["wet", "wet", "vet", "vet"], ["while", "waɪl", "vile", "vaɪl"]],
    ["Añadir una /ɡ/ delante: water no es «guater».", "Confundirla con /v/: wine ≠ vine."],
  ),
};

// [IPA_DETAILS]: tabla por idioma | `Partial<Record<…>>` (TS): de momento solo el inglés tiene el detalle ampliado; el resto muestra la regla + recursos del docente
const IPA_DETAILS: Partial<Record<Language, Readonly<Record<string, PhonemeDetail>>>> = { en: IPA_DETAILS_EN };

// [phonemeDetail]: detalle ampliado de un fonema o null | Función pura
export const phonemeDetail = (language: Language, symbol: string): PhonemeDetail | null => IPA_DETAILS[language]?.[symbol] ?? null;

// [phonemeHref]: URL de la página de detalle | `encodeURIComponent` lo hace URLSearchParams (símbolos IPA como «ʃ» o «tʃ» viajan seguros) | [Principio]: SSOT de la ruta
export const phonemeHref = (language: Language, symbol: string): string => `/resources/fonema?${new URLSearchParams({ language, p: symbol })}`;
