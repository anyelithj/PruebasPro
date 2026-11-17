import type { HelpLocale } from './entities/faq.entity';
import type { GuideMode } from './guide-fallback';
// [GuideBasics · Dominio · 2026-11-09]: GENERADO por ai-service/scripts/gen_guide_basics_ts.py desde agents/guide_basics.py — no editar a mano
// Saludo/agradecimiento, «sigue sin funcionar», «no encuentro X» y pasos de los temas frecuentes SIN IA | [Patrón]: Lookup Table | [Principio]: Deterministic-first

const GREETING = /^\s*(hola|buenas|buenos d[ií]as|buenas (tardes|noches)|hey|hi|hello|good (morning|afternoon|evening))\W*$/i;
const THANKS = /^\s*(gracias|muchas gracias|ok|vale|perfecto|genial|listo|thanks|thank you|great|bye|adi[oó]s|chao)\W*$/i;
const STILL_FAILING = /(sigue|contin[uú]a|persiste|todav[ií]a|a[uú]n)\s+(igual|sin|el problema|fallando|sin funcionar)|(problema|error)\s+(sigue|contin[uú]a|persiste)|ya (lo )?(hice|realic[eé]|intent[eé]|prob[eé]|segu[ií])|no (me )?(funcion[oó]|sirvi[oó])|still (not|does not|doesn't)|already tried|did not work|didn't work/i;
const RESOLVED = /ya (funciona|sirve|se oye|suena|qued[oó]|carga|pude|puedo)|solucionad|resuelt|it works|works now|fixed it/i;
const WHERE = /no (encuentro|veo|aparece)|d[oó]nde (est[aá]|encuentro|queda|veo)|c[oó]mo (llego|entro) a|where (is|are|can i find)|can'?t find/i;
const SMALL_TALK: Record<'greeting' | 'thanks' | 'still', Record<GuideMode, Record<HelpLocale, string>>> = {
  "greeting": {
    "support": {
      "es": "¡Hola! Cuéntame qué te pasa (por ejemplo: no puedo entrar, un pago, no se oye el audio o el micrófono no funciona) y te ayudo paso a paso.",
      "en": "Hi! Tell me what is happening (for example: I cannot log in, a payment, no sound or the microphone does not work) and I will help you step by step."
    },
    "guide": {
      "es": "¡Hola! ¿Qué quieres hacer en la plataforma? Por ejemplo: inscribirte en un curso, pagar, ver tu progreso o conseguir tu certificado.",
      "en": "Hi! What do you want to do on the platform? For example: enrol in a course, pay, see your progress or get your certificate."
    }
  },
  "thanks": {
    "support": {
      "es": "¡Con gusto! Si vuelve a pasar algo, aquí estoy.",
      "en": "You are welcome! If anything else happens, I am here."
    },
    "guide": {
      "es": "¡Con gusto! Si quieres, pregúntame por otra parte de la plataforma.",
      "en": "You are welcome! Ask me about any other part of the platform."
    }
  },
  "still": {
    "support": {
      "es": "Siento que siga sin funcionar. Como ya probaste lo básico, lo mejor es que lo revise una persona de nuestro equipo:\n1. Pulsa el botón «Contactar con soporte» que está debajo de este chat.\n2. Cuéntanos con tus palabras qué intentabas hacer y qué pasa (el mensaje que ves, si aparece alguno).\n3. Si puedes, adjunta una foto de la pantalla.\nTe responderemos por correo lo antes posible.",
      "en": "Sorry it still does not work. Since you already tried the basics, the best is that a person from our team checks it:\n1. Press the «Contact support» button below this chat.\n2. Tell us in your own words what you were trying to do and what happens (the message you see, if any).\n3. If you can, attach a picture of the screen.\nWe will reply by email as soon as possible."
    },
    "guide": {
      "es": "Entiendo, vamos de otra forma. Dime en una frase qué quieres lograr (por ejemplo «ver mis cursos» o «descargar mi certificado») y te digo exactamente dónde pulsar. Si algo no se comporta como te expliqué, pulsa «Contactar con soporte» debajo de este chat y una persona te ayuda.",
      "en": "I see, let us try another way. Tell me in one sentence what you want to do (for example «see my courses» or «download my certificate») and I will tell you exactly where to click. If something does not behave as I explained, press «Contact support» below this chat and a person will help you."
    }
  }
};

const PLACES: [RegExp, Record<HelpLocale, string>][] = [
  [/comprar|compra\b|buy/i, {"es": "El botón «Comprar» está dentro de cada curso de pago: pulsa «Cursos» en el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba), abre el curso y lo verás arriba, junto al precio. Si en su lugar ves «Inscribirme», el curso es gratis; si ves «Iniciar curso» o «Continuar», ya lo tienes.", "en": "The «Buy» button is inside each paid course: press «Courses» in the main menu (on the left of the screen; on a phone, tap the ☰ button at the top), open the course and you will see it at the top, next to the price. If you see «Enrol» instead, the course is free; if you see «Start course» or «Continue», you already have it."}],
  [/curso|course/i, {"es": "Los cursos están en el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba): pulsa «Cursos». Ahí puedes buscar por idioma o nivel. Los cursos en los que ya estás inscrito aparecen también en «Inicio».", "en": "Courses are in the main menu (on the left of the screen; on a phone, tap the ☰ button at the top): press «Courses». There you can search by language or level. Courses you are enrolled in also appear on «Home»."}],
  [/examen|ex[aá]menes|quiz|exam/i, {"es": "Los exámenes están en el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba): pulsa «Exámenes». Usa el buscador de arriba para filtrar por tipo, idioma o nivel.", "en": "Exams are in the main menu (on the left of the screen; on a phone, tap the ☰ button at the top): press «Exams». Use the search box at the top to filter by type, language or level."}],
  [/certificad|certificate/i, {"es": "Tus certificados están en el menú de tu foto o tus iniciales (arriba a la derecha) → «Mis certificados».", "en": "Your certificates are in your photo or initials menu (top right) → «My certificates»."}],
  [/pago|recibo|factura|payment|receipt/i, {"es": "Tus pagos y recibos están en el menú de tu foto o tus iniciales (arriba a la derecha) → «Mis pagos».", "en": "Your payments and receipts are in your photo or initials menu (top right) → «My payments»."}],
  [/perfil|mis datos|contrase[ñn]a|profile|password/i, {"es": "Tus datos están en el menú de tu foto o tus iniciales (arriba a la derecha) → «Mi perfil».", "en": "Your details are in your photo or initials menu (top right) → «My profile»."}],
  [/progreso|avance|progress/i, {"es": "Tu progreso está en el menú de tu foto o tus iniciales (arriba a la derecha) → «Mi progreso».", "en": "Your progress is in your photo or initials menu (top right) → «My progress»."}],
  [/tutor|chat/i, {"es": "El tutor está en el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba): pulsa «Tutor IA».", "en": "The tutor is in the main menu (on the left of the screen; on a phone, tap the ☰ button at the top): press «AI Tutor»."}],
  [/actividad|juego|canci[oó]n|di[aá]logo|vocabulario|activit|game|song/i, {"es": "Las actividades (juegos, canciones, diálogos, vocabulario…) están en el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba): pulsa «Actividades».", "en": "Activities (games, songs, dialogues, vocabulary…) are in the main menu (on the left of the screen; on a phone, tap the ☰ button at the top): press «Activities»."}],
];

const TOPICS: [RegExp, Record<HelpLocale, string>][] = [
  [/micr[oó]fono|microphone|\bmic\b|no me (oye|escucha)|grabar mi voz/i, {"es": "Vamos a revisar el micrófono:\n1. Arriba, a la izquierda de la dirección de la página, toca el candado 🔒 y en «Micrófono» elige «Permitir».\n2. Vuelve a cargar la página (tecla F5).\n3. Si usas auriculares con micrófono, revisa que estén bien conectados.\n4. Cierra otros programas que puedan estar usándolo (Zoom, Teams, WhatsApp Web…).\n5. Usa Google Chrome o Microsoft Edge: en otros navegadores el micrófono puede no funcionar aquí.\n¿Sigue sin funcionar? Pulsa «Contactar con soporte» debajo de este chat y dinos qué navegador usas.", "en": "Let us check the microphone:\n1. At the top, left of the page address, tap the 🔒 padlock and set «Microphone» to «Allow».\n2. Reload the page (F5 key).\n3. If you use a headset, check it is plugged in properly.\n4. Close other programs that may be using it (Zoom, Teams, WhatsApp Web…).\n5. Use Google Chrome or Microsoft Edge: in other browsers the microphone may not work here.\nStill not working? Press «Contact support» below this chat and tell us which browser you use."}],
  [/no (se )?oye|no (hay|tiene) sonido|audio|sonido|cannot hear|no sound/i, {"es": "Si no se oye nada:\n1. Sube el volumen de tu equipo o celular.\n2. Revisa que los altavoces o auriculares estén conectados y encendidos.\n3. Vuelve a pulsar el botón 🔊: el navegador no deja sonar nada hasta que tocas la página.\n4. Vuelve a cargar la página (tecla F5).\n¿Sigue sin sonar? Pulsa «Contactar con soporte» debajo de este chat.", "en": "If you cannot hear anything:\n1. Turn up the volume of your computer or phone.\n2. Check your speakers or headphones are connected and on.\n3. Press 🔊 again: the browser does not play sound until you tap the page.\n4. Reload the page (F5 key).\nStill no sound? Press «Contact support» below this chat."}],
  [/contrase[ñn]a|password|olvid/i, {"es": "Para crear una contraseña nueva:\n1. En la pantalla de «Iniciar sesión», pulsa «¿Olvidaste tu contraseña?».\n2. Escribe el correo con el que te registraste y pulsa «Enviar».\n3. Abre tu correo: te llegará un mensaje nuestro (si no lo ves, mira en «Spam» o «Correo no deseado»).\n4. Pulsa el botón del mensaje y escribe tu contraseña nueva.", "en": "To create a new password:\n1. On the «Log in» screen, press «Forgot your password?».\n2. Type the email you registered with and press «Send».\n3. Open your email: you will get a message from us (if you do not see it, check «Spam»).\n4. Press the button in the message and type your new password."}],
  [/iniciar sesi[oó]n|no puedo (entrar|acceder|ingresar)|login|log in|sign in/i, {"es": "Vamos a solucionarlo:\n1. Revisa que tu correo esté bien escrito (sin espacios al principio ni al final).\n2. Si no recuerdas tu contraseña, en la pantalla de «Iniciar sesión» pulsa «¿Olvidaste tu contraseña?» y sigue los pasos que te llegan al correo.\n3. Si te registraste hace poco, busca en tu correo nuestro mensaje de bienvenida y pulsa el botón para confirmar tu cuenta.\n4. Prueba a entrar desde otro navegador o desde tu celular.\nSi con esto no logras entrar, escríbeme y te ayudo a contactar con una persona del equipo.", "en": "Let us fix it:\n1. Check your email is typed correctly (no spaces at the start or end).\n2. If you forgot your password, on the «Log in» screen press «Forgot your password?» and follow the steps sent to your email.\n3. If you registered recently, look for our welcome email and press the button to confirm your account.\n4. Try logging in from another browser or from your phone.\nIf you still cannot get in, tell me and I will help you reach a person from our team."}],
  [/pago|pagar|cobro|tarjeta|comprar|payment|pay\b|charge|buy/i, {"es": "Sobre pagos:\n1. Para comprar un curso, ábrelo desde «Cursos» en el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba) y pulsa «Comprar».\n2. Tus pagos y recibos están en el menú de tu foto o tus iniciales (arriba a la derecha) → «Mis pagos».\n3. Si te cobraron y el curso no aparece, espera unos minutos y vuelve a cargar la página. Si sigue igual, pulsa «Contactar con soporte» e indícanos la fecha y el valor del cobro (nunca nos envíes los datos de tu tarjeta).", "en": "About payments:\n1. To buy a course, open it from «Courses» in the main menu (on the left of the screen; on a phone, tap the ☰ button at the top) and press «Buy».\n2. Your payments and receipts are in your photo or initials menu (top right) → «My payments».\n3. If you were charged and the course does not appear, wait a few minutes and reload. If nothing changes, press «Contact support» and tell us the date and amount (never send us your card details)."}],
  [/certificad|certificate/i, {"es": "Para conseguir tu certificado:\n1. Completa el curso al 100 % (todos los temas).\n2. Al final del temario se desbloquea el examen final: apruébalo con 70 % o más (tienes 3 intentos).\n3. Tu certificado aparece en el menú de tu foto o tus iniciales (arriba a la derecha) → «Mis certificados», donde puedes descargarlo y compartirlo.", "en": "To get your certificate:\n1. Complete the course 100% (all topics).\n2. At the end of the syllabus the final exam unlocks: pass it with 70% or more (you have 3 attempts).\n3. Your certificate appears in your photo or initials menu (top right) → «My certificates», where you can download and share it."}],
  [/inscrib|matricul|apunt|enrol|enroll|sign up for/i, {"es": "Para inscribirte en un curso:\n1. Pulsa «Cursos» en el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba).\n2. Elige el idioma o el nivel que te interese y abre el curso.\n3. Si es gratis, pulsa «Inscribirme»; si es de pago, pulsa «Comprar» y completa el pago.\n4. Listo: el curso aparece en «Inicio» y puedes empezar con «Iniciar curso».", "en": "To enrol in a course:\n1. Press «Courses» in the main menu (on the left of the screen; on a phone, tap the ☰ button at the top).\n2. Choose the language or level you like and open the course.\n3. If it is free, press «Enrol»; if it is paid, press «Buy» and complete the payment.\n4. Done: the course appears on «Home» and you can begin with «Start course»."}],
  [/perfil|mis datos|profile|nombre|foto/i, {"es": "Para cambiar tus datos: abre el menú de tu foto o tus iniciales (arriba a la derecha) → «Mi perfil», cambia tu nombre, foto o descripción y pulsa «Guardar».", "en": "To change your details: open your photo or initials menu (top right) → «My profile», change your name, photo or description and press «Save»."}],
  [/progreso|avance|progress/i, {"es": "Tu progreso está en el menú de tu foto o tus iniciales (arriba a la derecha) → «Mi progreso». Dentro de cada curso, el temario marca con ✓ los temas que ya completaste.", "en": "Your progress is in your photo or initials menu (top right) → «My progress». Inside each course, the syllabus marks completed topics with ✓."}],
  [/no carga|se queda (cargando|en blanco)|pantalla en blanco|error|not load|blank page/i, {"es": "Si una página no carga:\n1. Vuelve a cargarla (tecla F5).\n2. Revisa que tengas internet (abre otra página, por ejemplo Google).\n3. Cierra el navegador, ábrelo de nuevo e inténtalo otra vez.\nSi aparece un mensaje de error, pulsa «Contactar con soporte» y envíanos una foto de la pantalla.", "en": "If a page does not load:\n1. Reload it (F5 key).\n2. Check you have internet (open another page, e.g. Google).\n3. Close the browser, open it again and retry.\nIf an error message appears, press «Contact support» and send us a picture of the screen."}],
];

export const NO_ANSWER: Record<HelpLocale, Record<GuideMode, string>> = {
  es: { support: "Quiero ayudarte bien. ¿Me cuentas con tus palabras qué intentabas hacer y qué pasó? Por ejemplo: «quería entrar a mi curso y la pantalla se queda en blanco». Si prefieres que te atienda una persona, pulsa «Contactar con soporte» debajo de este chat.", guide: "No estoy seguro de haberte entendido. ¿Qué quieres hacer? Por ejemplo: «inscribirme en un curso», «ver mis exámenes» o «descargar mi certificado», y te digo dónde pulsar." },
  en: { support: "I want to help you properly. Can you tell me in your own words what you were trying to do and what happened? For example: «I wanted to open my course and the screen stays blank». If you prefer a person, press «Contact support» below this chat.", guide: "I am not sure I understood. What do you want to do? For example: «enrol in a course», «see my exams» or «download my certificate», and I will tell you where to click." },
};

export function smallTalk(text: string, mode: GuideMode, locale: HelpLocale): string | null {
  const kind = GREETING.test(text) ? 'greeting' : THANKS.test(text) ? 'thanks' : STILL_FAILING.test(text) ? 'still' : RESOLVED.test(text) ? 'thanks' : null;
  return kind ? SMALL_TALK[kind][mode][locale] : null;
}

export function basicAnswer(text: string, locale: HelpLocale): string | null {
  const rows = WHERE.test(text) ? [...PLACES, ...TOPICS] : TOPICS;
  return rows.find(([re]) => re.test(text))?.[1][locale] ?? null;
}
