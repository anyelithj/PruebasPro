"""Value Object TopicScript — apertura y objetivos de un tema de diálogo (Sprint 9.6, RF-122).

[Patrón]: Value Object inmutable (Pydantic frozen) + Lookup Table (aperturas por tema e idioma).
[Principio]: determinístico primero — el primer turno del avatar nunca pasa por el LLM; sin estado en FastAPI
(el tema, el turno y el historial los guarda NestJS Dialogues y llegan en cada petición).
[Paradigma]: Declarativo + funciones puras.
"""

from types import MappingProxyType

from pydantic import BaseModel, ConfigDict, Field

# [Aperturas]: los ocho temas semilla de NestJS (dialogue-topics.seed.ts) × los siete idiomas · `MappingProxyType`: solo lectura
OPENINGS = MappingProxyType(
    {
        "introductions": {
            "en": "Hi! I'm Aula. What's your name, and where are you from?",
            "es": "¡Hola! Soy Aula. ¿Cómo te llamas y de dónde eres?",
            "fr": "Salut ! Je suis Aula. Comment tu t'appelles et d'où viens-tu ?",
            "de": "Hallo! Ich bin Aula. Wie heißt du und woher kommst du?",
            "pt": "Olá! Eu sou a Aula. Como você se chama e de onde você é?",
            "zh": "你好！我是Aula。你叫什么名字？你是哪里人？",
            "ru": "Привет! Я Аула. Как тебя зовут и откуда ты?",
        },
        "hobbies": {
            "en": "What do you like doing in your free time?",
            "es": "¿Qué te gusta hacer en tu tiempo libre?",
            "fr": "Qu'est-ce que tu aimes faire pendant ton temps libre ?",
            "de": "Was machst du gern in deiner Freizeit?",
            "pt": "O que você gosta de fazer no seu tempo livre?",
            "zh": "你有空的时候喜欢做什么？",
            "ru": "Что ты любишь делать в свободное время?",
        },
        "routines": {
            "en": "Tell me about your day. What time do you usually get up?",
            "es": "Cuéntame tu día. ¿A qué hora te levantas normalmente?",
            "fr": "Raconte-moi ta journée. À quelle heure tu te lèves d'habitude ?",
            "de": "Erzähl mir von deinem Tag. Wann stehst du normalerweise auf?",
            "pt": "Conte-me sobre o seu dia. A que horas você costuma acordar?",
            "zh": "说说你的一天吧。你一般几点起床？",
            "ru": "Расскажи о своём дне. Во сколько ты обычно встаёшь?",
        },
        "family": {
            "en": "Do you have a big family? Tell me about them.",
            "es": "¿Tienes una familia grande? Háblame de ella.",
            "fr": "Tu as une grande famille ? Parle-moi d'elle.",
            "de": "Hast du eine große Familie? Erzähl mir von ihr.",
            "pt": "Você tem uma família grande? Fale sobre ela.",
            "zh": "你家人多吗？给我介绍一下你的家人吧。",
            "ru": "У тебя большая семья? Расскажи о ней.",
        },
        "animals": {
            "en": "Do you have a pet, or what's your favourite animal?",
            "es": "¿Tienes mascota? ¿Cuál es tu animal favorito?",
            "fr": "Tu as un animal de compagnie ? Quel est ton animal préféré ?",
            "de": "Hast du ein Haustier? Was ist dein Lieblingstier?",
            "pt": "Você tem um animal de estimação? Qual é o seu animal favorito?",
            "zh": "你养宠物吗？你最喜欢什么动物？",
            "ru": "У тебя есть домашнее животное? Какое твоё любимое животное?",
        },
        "food": {
            "en": "What's your favourite food? Do you like cooking?",
            "es": "¿Cuál es tu comida favorita? ¿Te gusta cocinar?",
            "fr": "Quel est ton plat préféré ? Tu aimes cuisiner ?",
            "de": "Was isst du am liebsten? Kochst du gern?",
            "pt": "Qual é a sua comida favorita? Você gosta de cozinhar?",
            "zh": "你最喜欢吃什么？你喜欢做饭吗？",
            "ru": "Какая твоя любимая еда? Ты любишь готовить?",
        },
        "travel": {
            "en": "Where did you go on your last trip? Did you enjoy it?",
            "es": "¿Adónde fuiste en tu último viaje? ¿Te gustó?",
            "fr": "Où es-tu allé pendant ton dernier voyage ? Ça t'a plu ?",
            "de": "Wohin bist du zuletzt gereist? Hat es dir gefallen?",
            "pt": "Para onde você foi na sua última viagem? Gostou?",
            "zh": "你上次去哪儿旅行了？玩得开心吗？",
            "ru": "Куда ты ездил в последний раз? Тебе понравилось?",
        },
        "culture": {
            "en": "Which festival or tradition from your country do you like most?",
            "es": "¿Qué fiesta o tradición de tu país te gusta más?",
            "fr": "Quelle fête ou tradition de ton pays préfères-tu ?",
            "de": "Welches Fest oder welche Tradition aus deinem Land magst du am meisten?",
            "pt": "Qual festa ou tradição do seu país você mais gosta?",
            "zh": "你最喜欢你们国家的哪个节日或传统？",
            "ru": "Какой праздник или какая традиция твоей страны тебе нравится больше всего?",
        },
    }
)
# [Respaldo]: si el LLM no responde la conversación sigue con una pregunta abierta (nunca se bloquea)
FOLLOW_UP = MappingProxyType(
    {
        "en": "Interesting! Can you tell me a bit more?",
        "es": "¡Qué interesante! ¿Me cuentas un poco más?",
        "fr": "Intéressant ! Tu peux m'en dire un peu plus ?",
        "de": "Interessant! Kannst du mir ein bisschen mehr erzählen?",
        "pt": "Que interessante! Pode me contar um pouco mais?",
        "zh": "真有意思！能再多说一点吗？",
        "ru": "Интересно! Расскажешь немного подробнее?",
    }
)

# [Respaldos rotativos · 2026-10-20]: varias preguntas abiertas por idioma → si el LLM falla varias veces seguidas el avatar NO repite la misma frase
FOLLOW_UPS = MappingProxyType(
    {
        "en": (FOLLOW_UP["en"], "Why do you like it?", "When do you usually do that?", "Who do you share it with?", "What else can you tell me?", "How did you feel about that?"),
        "es": (FOLLOW_UP["es"], "¿Por qué te gusta?", "¿Cuándo lo sueles hacer?", "¿Con quién lo compartes?", "¿Qué más me puedes contar?", "¿Cómo te sentiste?"),
        "fr": (FOLLOW_UP["fr"], "Pourquoi tu aimes ça ?", "Quand est-ce que tu fais ça d'habitude ?", "Avec qui tu le partages ?", "Quoi d'autre ?", "Comment tu t'es senti ?"),
        "de": (FOLLOW_UP["de"], "Warum magst du das?", "Wann machst du das normalerweise?", "Mit wem teilst du das?", "Was kannst du mir noch erzählen?", "Wie hast du dich dabei gefühlt?"),
        "pt": (FOLLOW_UP["pt"], "Por que você gosta disso?", "Quando você costuma fazer isso?", "Com quem você compartilha?", "O que mais você pode me contar?", "Como você se sentiu?"),
        "zh": (FOLLOW_UP["zh"], "你为什么喜欢？", "你一般什么时候做？", "你和谁一起？", "还有什么可以告诉我？", "你当时感觉怎么样？"),
        "ru": (FOLLOW_UP["ru"], "Почему тебе это нравится?", "Когда ты обычно это делаешь?", "С кем ты это делишь?", "Что ещё расскажешь?", "Что ты тогда почувствовал?"),
    }
)

# [Despedidas · 2026-10-23]: si el alumno se despide, el avatar cierra la conversación (antes seguía preguntando casi lo mismo) | [Patrón]: Constant Object (MappingProxyType = solo lectura)
FAREWELLS = MappingProxyType(
    {
        "en": ("goodbye", "good bye", "bye", "bye bye", "see you", "see you later", "see you soon", "good night", "take care", "i have to go", "i must go", "gotta go"),
        "es": ("adiós", "adios", "chao", "chau", "hasta luego", "hasta pronto", "hasta mañana", "nos vemos", "me tengo que ir", "buenas noches"),
        "fr": ("au revoir", "salut", "à bientôt", "a bientot", "à plus", "bonne nuit", "je dois partir"),
        "de": ("tschüss", "tschuss", "auf wiedersehen", "bis bald", "bis später", "gute nacht", "ich muss gehen"),
        "pt": ("tchau", "adeus", "até logo", "ate logo", "até mais", "boa noite", "tenho que ir"),
        "zh": ("再见", "拜拜", "回头见", "晚安"),
        "ru": ("пока", "до свидания", "до встречи", "спокойной ночи", "мне пора"),
    }
)

# [Cierre determinista]: lo que responde el avatar al despedirse (sin LLM → inmediato) + su traducción española
CLOSINGS = MappingProxyType(
    {
        "en": "It was great talking with you! Goodbye and see you next time.",
        "es": "¡Fue genial hablar contigo! Adiós y hasta la próxima.",
        "fr": "C'était super de parler avec toi ! Au revoir et à bientôt.",
        "de": "Es war schön, mit dir zu sprechen! Tschüss und bis zum nächsten Mal.",
        "pt": "Foi ótimo conversar com você! Tchau e até a próxima.",
        "zh": "和你聊天真开心！再见，下次见。",
        "ru": "Было здорово поговорить с тобой! Пока и до встречи.",
    }
)


class DialogueContext(BaseModel):
    """Lo que envía NestJS Dialogues en cada turno: tema, objetivos y vocabulario clave del tema."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    topic: str = Field(..., max_length=60, pattern=r"^[a-z0-9-]+$")  # Slug del tema (introductions, food…) o de un tema del docente
    title: str = Field(..., max_length=120)
    objectives: list[str] = Field(default_factory=list, max_length=8)
    vocabulary: list[str] = Field(default_factory=list, max_length=40)
    turn: int = Field(default=1, ge=1, le=200)
    opening: str | None = Field(default=None, max_length=300)  # Apertura escrita por el docente para un tema propio


def opening_es(ctx: DialogueContext, language: str) -> str | None:
    """Traducción española de la apertura: la del tema semilla en español; la del docente no se conoce (la traduce LanguageTools). [Paradigma]: función pura."""
    if ctx.opening or language == "es":
        return None
    return OPENINGS.get(ctx.topic, {}).get("es") or f"¿{ctx.title}? {FOLLOW_UP['es']}"


def opening(ctx: DialogueContext, language: str) -> str:
    """Apertura determinista: la del docente, la del tema semilla o una genérica con el título. [Paradigma]: función pura."""
    seeded = OPENINGS.get(ctx.topic, {}).get(language)
    return ctx.opening or seeded or f"{ctx.title}? {FOLLOW_UP.get(language, FOLLOW_UP['en'])}"
