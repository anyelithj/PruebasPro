"""Respuestas básicas del asistente de Soporte y Guía (2026-11-09).

[Por qué]: un saludo («hola») o los temas rápidos del propio chat («El micrófono no funciona», «¿Cómo me inscribo en un curso?»)
respondían «No encontré…» cuando el manual/FAQ no los cubría. Ahora: saludo/despedida → respuesta amable; tema frecuente → pasos fijos;
«ya hice los pasos y sigue igual» → paso a una persona; «no encuentro X» → dónde está X en el menú.
[Lenguaje]: el usuario es un cliente, no un técnico → nada de rutas («/forgot-password»): botones y menús tal como los ve.
[Patrón]: Lookup Table (regex → texto) | [Principio]: Deterministic-first (sin LLM) | [Paradigma]: Funcional (funciones puras).
Mismo contenido que backend/src/modules/help/domain/guide-basics.ts (modo sin IA de NestJS) → regenerar con scripts/gen_guide_basics_ts.py.
"""

import re

_GREETING = re.compile(r"^\s*(hola|buenas|buenos d[ií]as|buenas (tardes|noches)|hey|hi|hello|good (morning|afternoon|evening))\W*$", re.I)
_THANKS = re.compile(r"^\s*(gracias|muchas gracias|ok|vale|perfecto|genial|listo|thanks|thank you|great|bye|adi[oó]s|chao)\W*$", re.I)
# [2026-11-11 · «listo, ya funciona» → «¿Me cuentas qué pasó?»]: problema resuelto = agradecimiento
_RESOLVED = re.compile(r"ya (funciona|sirve|se oye|suena|qued[oó]|carga|pude|puedo)|solucionad|resuelt|it works|works now|fixed it", re.I)
# «Ya hice todo eso y sigue igual» → no repetir los pasos: pasar el caso a una persona
_STILL_FAILING = re.compile(
    r"(sigue|contin[uú]a|persiste|todav[ií]a|a[uú]n)\s+(igual|sin|el problema|fallando|sin funcionar)|(problema|error)\s+(sigue|contin[uú]a|persiste)"
    r"|ya (lo )?(hice|realic[eé]|intent[eé]|prob[eé]|segu[ií])|no (me )?(funcion[oó]|sirvi[oó])|still (not|does not|doesn't)|already tried|did not work|didn't work",
    re.I,
)
_WHERE = re.compile(r"no (encuentro|veo|aparece)|d[oó]nde (est[aá]|encuentro|queda|veo)|c[oó]mo (llego|entro) a|where (is|are|can i find)|can'?t find", re.I)

MENU_ES = "el menú principal (a la izquierda de la pantalla; en el celular, toca el botón ☰ de arriba)"
MENU_EN = "the main menu (on the left of the screen; on a phone, tap the ☰ button at the top)"
AVATAR_ES = "el menú de tu foto o tus iniciales (arriba a la derecha)"
AVATAR_EN = "your photo or initials menu (top right)"

_SMALL_TALK = {
    "greeting": {
        "support": {
            "es": "¡Hola! Cuéntame qué te pasa (por ejemplo: no puedo entrar, un pago, no se oye el audio o el micrófono no funciona) y te ayudo paso a paso.",
            "en": "Hi! Tell me what is happening (for example: I cannot log in, a payment, no sound or the microphone does not work) and I will help you step by step.",
        },
        "guide": {
            "es": "¡Hola! ¿Qué quieres hacer en la plataforma? Por ejemplo: inscribirte en un curso, pagar, ver tu progreso o conseguir tu certificado.",
            "en": "Hi! What do you want to do on the platform? For example: enrol in a course, pay, see your progress or get your certificate.",
        },
    },
    "thanks": {
        "support": {"es": "¡Con gusto! Si vuelve a pasar algo, aquí estoy.", "en": "You are welcome! If anything else happens, I am here."},
        "guide": {"es": "¡Con gusto! Si quieres, pregúntame por otra parte de la plataforma.", "en": "You are welcome! Ask me about any other part of the platform."},
    },
    "still": {
        "support": {
            "es": "Siento que siga sin funcionar. Como ya probaste lo básico, lo mejor es que lo revise una persona de nuestro equipo:\n"
            "1. Pulsa el botón «Contactar con soporte» que está debajo de este chat.\n"
            "2. Cuéntanos con tus palabras qué intentabas hacer y qué pasa (el mensaje que ves, si aparece alguno).\n"
            "3. Si puedes, adjunta una foto de la pantalla.\n"
            "Te responderemos por correo lo antes posible.",
            "en": "Sorry it still does not work. Since you already tried the basics, the best is that a person from our team checks it:\n"
            "1. Press the «Contact support» button below this chat.\n"
            "2. Tell us in your own words what you were trying to do and what happens (the message you see, if any).\n"
            "3. If you can, attach a picture of the screen.\n"
            "We will reply by email as soon as possible.",
        },
        "guide": {
            "es": "Entiendo, vamos de otra forma. Dime en una frase qué quieres lograr (por ejemplo «ver mis cursos» o «descargar mi certificado») y te digo exactamente dónde pulsar. "
            "Si algo no se comporta como te expliqué, pulsa «Contactar con soporte» debajo de este chat y una persona te ayuda.",
            "en": "I see, let us try another way. Tell me in one sentence what you want to do (for example «see my courses» or «download my certificate») and I will tell you exactly where to click. "
            "If something does not behave as I explained, press «Contact support» below this chat and a person will help you.",
        },
    },
}

# (regex, {es, en}) — dónde está cada sección, con los nombres que el usuario ve
_PLACES: list[tuple[re.Pattern[str], dict[str, str]]] = [
    # [2026-11-11 · «no veo el botón de comprar»]: el botón depende del estado del curso
    (re.compile(r"comprar|compra\b|buy", re.I), {"es": f"El botón «Comprar» está dentro de cada curso de pago: pulsa «Cursos» en {MENU_ES}, abre el curso y lo verás arriba, junto al precio. Si en su lugar ves «Inscribirme», el curso es gratis; si ves «Iniciar curso» o «Continuar», ya lo tienes.", "en": f"The «Buy» button is inside each paid course: press «Courses» in {MENU_EN}, open the course and you will see it at the top, next to the price. If you see «Enrol» instead, the course is free; if you see «Start course» or «Continue», you already have it."}),
    (re.compile(r"curso|course", re.I), {"es": f"Los cursos están en {MENU_ES}: pulsa «Cursos». Ahí puedes buscar por idioma o nivel. Los cursos en los que ya estás inscrito aparecen también en «Inicio».", "en": f"Courses are in {MENU_EN}: press «Courses». There you can search by language or level. Courses you are enrolled in also appear on «Home»."}),
    (re.compile(r"examen|ex[aá]menes|quiz|exam", re.I), {"es": f"Los exámenes están en {MENU_ES}: pulsa «Exámenes». Usa el buscador de arriba para filtrar por tipo, idioma o nivel.", "en": f"Exams are in {MENU_EN}: press «Exams». Use the search box at the top to filter by type, language or level."}),
    (re.compile(r"certificad|certificate", re.I), {"es": f"Tus certificados están en {AVATAR_ES} → «Mis certificados».", "en": f"Your certificates are in {AVATAR_EN} → «My certificates»."}),
    (re.compile(r"pago|recibo|factura|payment|receipt", re.I), {"es": f"Tus pagos y recibos están en {AVATAR_ES} → «Mis pagos».", "en": f"Your payments and receipts are in {AVATAR_EN} → «My payments»."}),
    (re.compile(r"perfil|mis datos|contrase[ñn]a|profile|password", re.I), {"es": f"Tus datos están en {AVATAR_ES} → «Mi perfil».", "en": f"Your details are in {AVATAR_EN} → «My profile»."}),
    (re.compile(r"progreso|avance|progress", re.I), {"es": f"Tu progreso está en {AVATAR_ES} → «Mi progreso».", "en": f"Your progress is in {AVATAR_EN} → «My progress»."}),
    (re.compile(r"tutor|chat", re.I), {"es": f"El tutor está en {MENU_ES}: pulsa «Tutor IA».", "en": f"The tutor is in {MENU_EN}: press «AI Tutor»."}),
    (re.compile(r"actividad|juego|canci[oó]n|di[aá]logo|vocabulario|activit|game|song", re.I), {"es": f"Las actividades (juegos, canciones, diálogos, vocabulario…) están en {MENU_ES}: pulsa «Actividades».", "en": f"Activities (games, songs, dialogues, vocabulary…) are in {MENU_EN}: press «Activities»."}),
]

# (regex, {es, en}) — pasos para los temas frecuentes
_TOPICS: list[tuple[re.Pattern[str], dict[str, str]]] = [
    (re.compile(r"micr[oó]fono|microphone|\bmic\b|no me (oye|escucha)|grabar mi voz", re.I), {
        "es": "Vamos a revisar el micrófono:\n1. Arriba, a la izquierda de la dirección de la página, toca el candado 🔒 y en «Micrófono» elige «Permitir».\n2. Vuelve a cargar la página (tecla F5).\n3. Si usas auriculares con micrófono, revisa que estén bien conectados.\n4. Cierra otros programas que puedan estar usándolo (Zoom, Teams, WhatsApp Web…).\n5. Usa Google Chrome o Microsoft Edge: en otros navegadores el micrófono puede no funcionar aquí.\n¿Sigue sin funcionar? Pulsa «Contactar con soporte» debajo de este chat y dinos qué navegador usas.",
        "en": "Let us check the microphone:\n1. At the top, left of the page address, tap the 🔒 padlock and set «Microphone» to «Allow».\n2. Reload the page (F5 key).\n3. If you use a headset, check it is plugged in properly.\n4. Close other programs that may be using it (Zoom, Teams, WhatsApp Web…).\n5. Use Google Chrome or Microsoft Edge: in other browsers the microphone may not work here.\nStill not working? Press «Contact support» below this chat and tell us which browser you use.",
    }),
    (re.compile(r"no (se )?oye|no (hay|tiene) sonido|audio|sonido|cannot hear|no sound", re.I), {
        "es": "Si no se oye nada:\n1. Sube el volumen de tu equipo o celular.\n2. Revisa que los altavoces o auriculares estén conectados y encendidos.\n3. Vuelve a pulsar el botón 🔊: el navegador no deja sonar nada hasta que tocas la página.\n4. Vuelve a cargar la página (tecla F5).\n¿Sigue sin sonar? Pulsa «Contactar con soporte» debajo de este chat.",
        "en": "If you cannot hear anything:\n1. Turn up the volume of your computer or phone.\n2. Check your speakers or headphones are connected and on.\n3. Press 🔊 again: the browser does not play sound until you tap the page.\n4. Reload the page (F5 key).\nStill no sound? Press «Contact support» below this chat.",
    }),
    (re.compile(r"contrase[ñn]a|password|olvid", re.I), {
        "es": "Para crear una contraseña nueva:\n1. En la pantalla de «Iniciar sesión», pulsa «¿Olvidaste tu contraseña?».\n2. Escribe el correo con el que te registraste y pulsa «Enviar».\n3. Abre tu correo: te llegará un mensaje nuestro (si no lo ves, mira en «Spam» o «Correo no deseado»).\n4. Pulsa el botón del mensaje y escribe tu contraseña nueva.",
        "en": "To create a new password:\n1. On the «Log in» screen, press «Forgot your password?».\n2. Type the email you registered with and press «Send».\n3. Open your email: you will get a message from us (if you do not see it, check «Spam»).\n4. Press the button in the message and type your new password.",
    }),
    (re.compile(r"iniciar sesi[oó]n|no puedo (entrar|acceder|ingresar)|login|log in|sign in", re.I), {
        "es": "Vamos a solucionarlo:\n1. Revisa que tu correo esté bien escrito (sin espacios al principio ni al final).\n2. Si no recuerdas tu contraseña, en la pantalla de «Iniciar sesión» pulsa «¿Olvidaste tu contraseña?» y sigue los pasos que te llegan al correo.\n3. Si te registraste hace poco, busca en tu correo nuestro mensaje de bienvenida y pulsa el botón para confirmar tu cuenta.\n4. Prueba a entrar desde otro navegador o desde tu celular.\nSi con esto no logras entrar, escríbeme y te ayudo a contactar con una persona del equipo.",
        "en": "Let us fix it:\n1. Check your email is typed correctly (no spaces at the start or end).\n2. If you forgot your password, on the «Log in» screen press «Forgot your password?» and follow the steps sent to your email.\n3. If you registered recently, look for our welcome email and press the button to confirm your account.\n4. Try logging in from another browser or from your phone.\nIf you still cannot get in, tell me and I will help you reach a person from our team.",
    }),
    (re.compile(r"pago|pagar|cobro|tarjeta|comprar|payment|pay\b|charge|buy", re.I), {
        "es": f"Sobre pagos:\n1. Para comprar un curso, ábrelo desde «Cursos» en {MENU_ES} y pulsa «Comprar».\n2. Tus pagos y recibos están en {AVATAR_ES} → «Mis pagos».\n3. Si te cobraron y el curso no aparece, espera unos minutos y vuelve a cargar la página. Si sigue igual, pulsa «Contactar con soporte» e indícanos la fecha y el valor del cobro (nunca nos envíes los datos de tu tarjeta).",
        "en": f"About payments:\n1. To buy a course, open it from «Courses» in {MENU_EN} and press «Buy».\n2. Your payments and receipts are in {AVATAR_EN} → «My payments».\n3. If you were charged and the course does not appear, wait a few minutes and reload. If nothing changes, press «Contact support» and tell us the date and amount (never send us your card details).",
    }),
    (re.compile(r"certificad|certificate", re.I), {
        "es": f"Para conseguir tu certificado:\n1. Completa el curso al 100 % (todos los temas).\n2. Al final del temario se desbloquea el examen final: apruébalo con 70 % o más (tienes 3 intentos).\n3. Tu certificado aparece en {AVATAR_ES} → «Mis certificados», donde puedes descargarlo y compartirlo.",
        "en": f"To get your certificate:\n1. Complete the course 100% (all topics).\n2. At the end of the syllabus the final exam unlocks: pass it with 70% or more (you have 3 attempts).\n3. Your certificate appears in {AVATAR_EN} → «My certificates», where you can download and share it.",
    }),
    (re.compile(r"inscrib|matricul|apunt|enrol|enroll|sign up for", re.I), {
        "es": f"Para inscribirte en un curso:\n1. Pulsa «Cursos» en {MENU_ES}.\n2. Elige el idioma o el nivel que te interese y abre el curso.\n3. Si es gratis, pulsa «Inscribirme»; si es de pago, pulsa «Comprar» y completa el pago.\n4. Listo: el curso aparece en «Inicio» y puedes empezar con «Iniciar curso».",
        "en": f"To enrol in a course:\n1. Press «Courses» in {MENU_EN}.\n2. Choose the language or level you like and open the course.\n3. If it is free, press «Enrol»; if it is paid, press «Buy» and complete the payment.\n4. Done: the course appears on «Home» and you can begin with «Start course».",
    }),
    (re.compile(r"perfil|mis datos|profile|nombre|foto", re.I), {
        "es": f"Para cambiar tus datos: abre {AVATAR_ES} → «Mi perfil», cambia tu nombre, foto o descripción y pulsa «Guardar».",
        "en": f"To change your details: open {AVATAR_EN} → «My profile», change your name, photo or description and press «Save».",
    }),
    (re.compile(r"progreso|avance|progress", re.I), {
        "es": f"Tu progreso está en {AVATAR_ES} → «Mi progreso». Dentro de cada curso, el temario marca con ✓ los temas que ya completaste.",
        "en": f"Your progress is in {AVATAR_EN} → «My progress». Inside each course, the syllabus marks completed topics with ✓.",
    }),
    (re.compile(r"no carga|se queda (cargando|en blanco)|pantalla en blanco|error|not load|blank page", re.I), {
        "es": "Si una página no carga:\n1. Vuelve a cargarla (tecla F5).\n2. Revisa que tengas internet (abre otra página, por ejemplo Google).\n3. Cierra el navegador, ábrelo de nuevo e inténtalo otra vez.\nSi aparece un mensaje de error, pulsa «Contactar con soporte» y envíanos una foto de la pantalla.",
        "en": "If a page does not load:\n1. Reload it (F5 key).\n2. Check you have internet (open another page, e.g. Google).\n3. Close the browser, open it again and retry.\nIf an error message appears, press «Contact support» and send us a picture of the screen.",
    }),
]

NO_ANSWER = {
    "support": {
        "es": "Quiero ayudarte bien. ¿Me cuentas con tus palabras qué intentabas hacer y qué pasó? Por ejemplo: «quería entrar a mi curso y la pantalla se queda en blanco». "
        "Si prefieres que te atienda una persona, pulsa «Contactar con soporte» debajo de este chat.",
        "en": "I want to help you properly. Can you tell me in your own words what you were trying to do and what happened? For example: «I wanted to open my course and the screen stays blank». "
        "If you prefer a person, press «Contact support» below this chat.",
    },
    "guide": {
        "es": "No estoy seguro de haberte entendido. ¿Qué quieres hacer? Por ejemplo: «inscribirme en un curso», «ver mis exámenes» o «descargar mi certificado», y te digo dónde pulsar.",
        "en": "I am not sure I understood. What do you want to do? For example: «enrol in a course», «see my exams» or «download my certificate», and I will tell you where to click.",
    },
}


def small_talk(text: str, mode: str, locale: str) -> str | None:
    """Saludo, agradecimiento o «sigue sin funcionar» → respuesta del modo; si no, None. | Función pura."""
    kind = (
        "greeting" if _GREETING.match(text)
        else "thanks" if _THANKS.match(text)
        else "still" if _STILL_FAILING.search(text)
        else "thanks" if _RESOLVED.search(text)
        else None
    )
    return _SMALL_TALK[kind][mode][locale] if kind else None


def basic_answer(text: str, locale: str) -> str | None:
    """«No encuentro X» → dónde está X; tema frecuente (micrófono, audio, contraseña…) → pasos; si no, None. | Función pura."""
    table = _PLACES if _WHERE.search(text) else []
    for pattern, answer in [*table, *_TOPICS]:
        if pattern.search(text):
            return answer[locale]
    return None


if __name__ == "__main__":  # Autocomprobación: python -m src.modules.assistant.infrastructure.agents.guide_basics
    assert small_talk("hola", "support", "es") and small_talk("Hola!", "guide", "es")
    assert small_talk("hola, el micro falla", "support", "es") is None
    assert "persona" in (small_talk("ya realice todos esos pasos y el problema continua", "support", "es") or "")
    assert "Micrófono" in (basic_answer("El micrófono no funciona", "es") or "")
    assert "inscribirte" in (basic_answer("¿Cómo me inscribo en un curso?", "es") or "")
    assert "«Cursos»" in (basic_answer("no encuentro la opción de /courses", "es") or "")
    assert basic_answer("quiero un unicornio", "es") is None
    assert "Con gusto" in (small_talk("listo, ya funciona", "support", "es") or "")
    assert "«Comprar»" in (basic_answer("no veo el botón de comprar", "es") or "")
    print("ok")
