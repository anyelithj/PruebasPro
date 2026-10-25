"""Builders de los 10 diagramas + main. Usa el core de gen_diagrams.py."""
from __future__ import annotations

from gen_diagrams import (
    Doc, OUT, C_DOM, C_APP, C_INF, C_PRE, C_PAT, C_NEW, C_EXT, COLOR_LEGEND,
)

# ===================== DATOS REALES =====================
# (campo, tipo_logico) por tabla. NEW=tabla nueva por RF (magenta).
TABLES = {
    "users": dict(new=False, pk="id", cols=[
        "id : uuid «PK»", "email : varchar(320) «UK»", "password_hash : varchar(255)",
        "first_name : varchar(80)", "last_name : varchar(80)", "role : users_role_enum",
        "is_active : bool = true", "is_email_verified : bool = false",
        "created_at / updated_at : timestamptz",
    ]),
    "auth_sessions": dict(new=False, pk="id", cols=[
        "id : uuid «PK»", "user_id : uuid «FK suave→users»", "refresh_token_hash : varchar(255)",
        "user_agent : varchar(255) NULL", "ip_address : varchar(64) NULL",
        "expires_at : timestamptz", "is_revoked : bool = false", "created_at : timestamptz",
    ]),
    "email_verification_tokens": dict(new=True, pk="id", cols=[
        "id : uuid «PK»", "user_id : uuid «FK suave→users»", "token_hash : varchar(255) «UK»",
        "expires_at : timestamptz", "used_at : timestamptz NULL", "created_at : timestamptz",
    ]),
    "password_reset_tokens": dict(new=True, pk="id", cols=[
        "id : uuid «PK»", "user_id : uuid «FK suave→users»", "token_hash : varchar(255) «UK»",
        "expires_at : timestamptz", "used_at : timestamptz NULL", "created_at : timestamptz",
    ]),
    "quizzes": dict(new=False, pk="id", cols=[
        "id : uuid «PK»", "title : varchar(160)", "description : text NULL",
        "category : quiz_category_enum", "difficulty : quiz_difficulty_enum",
        "language : quiz_language_enum", "author_id : uuid «FK suave→users»",
        "source : varchar(32) = 'custom'", "time_per_question_seconds : int = 30",
        "is_published : bool = false", "created_at / updated_at : timestamptz",
    ]),
    "questions": dict(new=False, pk="id", cols=[
        "id : uuid «PK»", "quiz_id : uuid «FK→quizzes ON DELETE CASCADE»",
        "text : text", "type : questions_type_enum", "options : jsonb NULL",
        "correct_answer : text", "difficulty : quiz_difficulty_enum",
        "language : quiz_language_enum", "position : int",
        "time_limit_seconds : int NULL", "explanation : text NULL", "feedback : text NULL",
    ]),
    "quiz_sessions": dict(new=False, pk="id", cols=[
        "id : uuid «PK»", "user_id : uuid «FK suave→users»", "quiz_id : uuid «FK suave→quizzes»",
        "status : quiz_sessions_status_enum", "answers : jsonb (SessionAnswer[])",
        "total_score : float = 0", "correct_count : int = 0",
        "started_at : timestamptz", "completed_at : timestamptz NULL",
    ]),
    "scores": dict(new=False, pk="id", cols=[
        "id : uuid «PK»", "user_id : uuid «FK suave→users»", "quiz_id : uuid «FK suave→quizzes»",
        "session_id : uuid «FK suave→quiz_sessions»", "points : float",
        "correct_count : int", "total_questions : int", "accuracy : float (derivado)",
        "created_at : timestamptz",
    ]),
    "achievements": dict(new=False, pk="id", cols=[
        "id : uuid «PK»", "user_id : uuid «FK suave→users»", "code : achievements_code_enum",
        "title : varchar(160)", "description : text NULL", "unlocked_at : timestamptz",
        "UNIQUE(user_id, code)",
    ]),
    "notifications": dict(new=True, pk="id", cols=[
        "id : uuid «PK»", "user_id : uuid «FK suave→users»", "type : notification_type_enum",
        "title : varchar(255)", "body : text", "payload : jsonb NULL",
        "is_read : bool = false", "read_at : timestamptz NULL", "created_at : timestamptz",
    ]),
    "feedback_ia": dict(new=True, pk="id", cols=[
        "id : uuid «PK»", "session_id : uuid «FK suave→quiz_sessions»",
        "question_id : uuid «FK suave→questions»", "user_id : uuid «FK suave→users»",
        "content : text", "suggestion : text NULL", "score : float", "is_correct : bool",
        "confidence : float NULL", "model : varchar(64)",
        "strategy_used : grading_strategy_enum", "latency_ms : int NULL", "created_at : timestamptz",
    ]),
}

ENUMS = {
    "users_role_enum": "USER, TEACHER, ADMIN",
    "quiz_category_enum": "general, science, history, geography, sports, entertainment, technology, math, art, custom",
    "quiz_difficulty_enum": "easy, medium, hard",
    "quiz_language_enum": "en, es",
    "questions_type_enum": "multiple_choice, true_false, open_answer",
    "quiz_sessions_status_enum": "in_progress, completed, abandoned",
    "achievements_code_enum": "first_quiz, perfect_score, streak_3, streak_10, speed_demon, points_1000, points_5000",
    "notification_type_enum  (NUEVO)": "ACHIEVEMENT, SCORE, EMAIL_VERIFY, PASSWORD_RESET, QUIZ_PUBLISHED, LOGIN_DEVICE, SYSTEM",
    "grading_strategy_enum  (NUEVO)": "similarity, llm_rubric, exact_match",
}

# relaciones (origen, destino, cardinalidad, cascade)
RELS = [
    ("users", "auth_sessions", "1 : N", False),
    ("users", "email_verification_tokens", "1 : N", False),
    ("users", "password_reset_tokens", "1 : N", False),
    ("users", "quizzes", "1 : N (author)", False),
    ("users", "quiz_sessions", "1 : N", False),
    ("users", "scores", "1 : N", False),
    ("users", "achievements", "1 : N", False),
    ("users", "notifications", "1 : N", False),
    ("users", "feedback_ia", "1 : N", False),
    ("quizzes", "questions", "1 : N CASCADE", True),
    ("quizzes", "quiz_sessions", "1 : N", False),
    ("quizzes", "scores", "1 : N", False),
    ("quiz_sessions", "scores", "1 : 1", False),
    ("quiz_sessions", "feedback_ia", "1 : N", False),
    ("questions", "feedback_ia", "1 : N", False),
]


def color_for(new: bool):
    return C_NEW if new else C_DOM


# ===================== 1. DER =====================
def der():
    d = Doc("DER", "DER - ProyDemo (real)", w=2700, h=1700)
    d.title("Diagrama Entidad-Relacion (DER) - ProyDemo · 11 tablas reales · FK suave entre bounded contexts · CASCADE solo questions→quizzes")
    # layout en columnas
    pos = {
        "users": (1180, 110),
        "auth_sessions": (130, 110),
        "email_verification_tokens": (130, 380),
        "password_reset_tokens": (130, 640),
        "quizzes": (1150, 560),
        "questions": (1150, 980),
        "quiz_sessions": (2050, 560),
        "scores": (2050, 110),
        "achievements": (2350, 980),
        "notifications": (130, 900),
        "feedback_ia": (1700, 1050),
    }
    ids = {}
    for name, (x, y) in pos.items():
        fill, stroke = color_for(TABLES[name]["new"])
        cid, _ = d.table(x, y, 360, name, TABLES[name]["cols"], fill, stroke)
        ids[name] = cid
    for a, b, card, cascade in RELS:
        d.edge(ids[a], ids[b], card,
               dashed=not cascade,
               style_extra="strokeColor=%s;" % ("#C62828" if cascade else "#607D8B"))
    d.legend(130, 1180, COLOR_LEGEND + [
        "Linea continua roja = FK dura CASCADE", "Linea discontinua = FK suave (uuid, sin @ManyToOne)",
    ], w=520, title="LEYENDA")
    d.note(680, 1500, 1400, 150,
           "FK SUAVE: columnas uuid sin @ManyToOne — preservan el desacople entre Bounded Contexts (Auth, Users, Quiz, Score, Notif, Feedback).\n"
           "CASCADE: solo questions→quizzes (intra-agregado Quiz, @OneToMany cascade insert/update + ON DELETE CASCADE).\n"
           "SessionAnswer[] va embebido como jsonb en quiz_sessions.answers (no es tabla).")
    return d


# ===================== 2. MODELO RELACIONAL =====================
def relacional():
    d = Doc("REL", "Modelo Relacional PostgreSQL - ProyDemo", w=2700, h=1900)
    d.title("Modelo Relacional PostgreSQL · 11 tablas · tipos reales, PK/FK/UK, ENUMs, JSONB, UUID, indices @Index")
    cols3 = [(130, 110), (1010, 110), (1890, 110)]
    order = list(TABLES.keys())
    colcount = [0, 0, 0]
    ys = [110, 110, 110]
    ids = {}
    for i, name in enumerate(order):
        col = i % 3
        x = cols3[col][0]
        y = ys[col]
        fill, stroke = color_for(TABLES[name]["new"])
        cid, h = d.table(x, y, 800, name, TABLES[name]["cols"], fill, stroke)
        ids[name] = cid
        ys[col] += h + 30
    # panel ENUMs
    enum_rows = [f"{k}: {{ {v} }}" for k, v in ENUMS.items()]
    d.box(130, max(ys) + 10, 2480, 250,
          "ENUMs NATIVOS POSTGRESQL\n\n" + "\n".join(enum_rows),
          C_PAT[0], C_PAT[1], fontsize=11, align="left", valign="top")
    d.note(130, max(ys) + 280, 2480, 160,
           "INDICES REALES (@Index TypeORM):\n"
           "users(email UK) · auth_sessions(user_id) · *_tokens(user_id, token_hash UK, expires_at) · "
           "quizzes(author_id, category, is_published, language) · questions(quiz_id) · "
           "quiz_sessions(user_id, quiz_id, status) · scores(user_id, quiz_id, created_at) · "
           "achievements(user_id, code, UNIQUE(user_id,code)) · notifications(user_id, (user_id,is_read), created_at) · "
           "feedback_ia(session_id, question_id, user_id, created_at).\n"
           "JSONB: questions.options, quiz_sessions.answers, notifications.payload. UUID PK en todas.")
    return d


# ===================== 3. NORMALIZACION =====================
def normalizacion():
    d = Doc("NORM", "Normalizacion - ProyDemo", w=2200, h=1500)
    d.title("Diagrama de Normalizacion · Matriz 1FN/2FN/3FN/BCNF por tabla + desnormalizaciones controladas")
    # matriz
    headers = ["Tabla", "1FN", "2FN", "3FN", "BCNF", "Observacion"]
    x0, y0, wcol = 120, 110, [340, 70, 70, 70, 80, 700]
    # header row
    cx = x0
    for j, hh in enumerate(headers):
        d.box(cx, y0, wcol[j], 34, hh, C_INF[0], C_INF[1], fontsize=11, bold=True)
        cx += wcol[j]
    rows = [
        ("users", "Si", "Si", "Si", "Si", "Normalizada"),
        ("auth_sessions", "Si", "Si", "Si", "Si", "Normalizada"),
        ("email_verification_tokens", "Si", "Si", "Si", "Si", "Normalizada"),
        ("password_reset_tokens", "Si", "Si", "Si", "Si", "Normalizada"),
        ("quizzes", "Si", "Si", "Si", "Si", "Normalizada"),
        ("questions", "1FN*", "Si", "3FN*", "Si", "options jsonb (1FN relajada) · language (3FN relajada i18n)"),
        ("quiz_sessions", "Si", "Si", "Si", "BCNF*", "answers jsonb (BCNF relajado, lectura atomica)"),
        ("scores", "Si", "Si", "3FN*", "Si", "accuracy derivado (desnorm. para ranking)"),
        ("achievements", "Si", "Si", "Si", "Si", "Normalizada"),
        ("notifications", "Si", "Si", "Si", "Si", "payload jsonb (atributo abierto por tipo)"),
        ("feedback_ia", "Si", "Si", "3FN*", "Si", "is_correct proyeccion de answers[].isCorrect"),
    ]
    ry = y0 + 34
    for r in rows:
        cx = x0
        new = TABLES.get(r[0], {}).get("new", False)
        fill = C_NEW[0] if new else "#FFFFFF"
        for j, val in enumerate(r):
            d.box(cx, ry, wcol[j], 30, val, fill if j == 0 else "#FFFFFF",
                  C_INF[1], fontsize=10, align="left" if j in (0, 5) else "center")
            cx += wcol[j]
        ry += 30
    d.box(120, ry + 20, 1530, 220,
          "DESNORMALIZACIONES CONTROLADAS (5) — justificadas por rendimiento/atomicidad:\n"
          "1) scores.accuracy — dependencia derivada (correct/total) precalculada para ranking O(log N) sin recomputar.\n"
          "2) questions.language — DF transitiva con quizzes.language; duplicada para i18n y filtros sin JOIN.\n"
          "3) quiz_sessions.answers JSONB — BCNF relajado: lectura/escritura atomica de la sesion completa.\n"
          "4) questions.options JSONB — 1FN relajada: lista de opciones como unidad logica atomica.\n"
          "5) feedback_ia.is_correct — duplica answers[].isCorrect como columna indexable/consultable.",
          C_PAT[0], C_PAT[1], fontsize=11, align="left", valign="top")
    d.note(1680, ry + 20, 460, 220,
           "* = forma normal relajada de forma deliberada.\n"
           "El resto de tablas cumple BCNF.\n"
           "Tokens, sesiones y scores son inmutables o append-only, "
           "lo que reduce anomalias de actualizacion.")
    return d


# ===================== 4. CLASES UML (HEXAGONAL) =====================
def clases():
    d = Doc("CLS", "Clases UML Hexagonal - ProyDemo", w=2700, h=1700)
    d.title("Diagrama de Clases UML · Arquitectura Hexagonal (Dominio/Aplicacion/Infraestructura/Presentacion) · solo clases reales")
    # bandas por capa
    d.box(40, 90, 2620, 30, "PRESENTACION (Controllers NestJS · DTO · Guards/Interceptors «Decorator/Chain of Responsibility»)", C_PRE[0], C_PRE[1], bold=True)
    d.box(40, 470, 2620, 30, "APLICACION (Use Cases «Command» · Listeners «Observer» · AIClientService «ACL/Adapter»)", C_APP[0], C_APP[1], bold=True)
    d.box(40, 940, 2620, 30, "DOMINIO (Entities/Aggregates · Value Objects · Ports «Repository»/Events)", C_DOM[0], C_DOM[1], bold=True)
    d.box(40, 1330, 2620, 30, "INFRAESTRUCTURA (Adapters TypeORM «Repository/Adapter» · Ollama providers «Strategy» · JWT/OAuth «Strategy»)", C_INF[0], C_INF[1], bold=True)

    # PRESENTACION
    pres = ["AuthController", "UsersController", "QuizController", "ScoreController", "AiController",
            "(NotificationsModule: sin controller)", "(FeedbackModule: sin controller)"]
    for i, c in enumerate(pres):
        new = "sin controller" in c
        d.box(60 + i*375, 130, 350, 90, c, C_NEW[0] if new else C_PRE[0], C_NEW[1] if new else C_PRE[1], fontsize=11, bold=not new)

    # APLICACION use-cases
    apps = [
        "AuthModule UC «Command»:\nLogin, OAuthLogin, Register,\nRefreshToken, Logout,\nVerifyEmail (stub), RequestPasswordReset (log),\nResetPassword",
        "QuizModule UC:\nCreateQuiz, GetQuiz, ListQuizzes,\nGenerateAIQuestions, StartSession,\nSubmitAnswer, EndSession «Saga», ListMyHistory",
        "ScoreModule UC:\nCalculateScore, SaveScore,\nCheckAchievements, GetLeaderboard,\nGetUserHistory\nQuizCompletedListener «Observer»",
        "UsersModule:\n(controller usa repo directo;\nUC GetProfile/UpdateProfile/\nGetUserHistory/DeleteAccount\nno cableados)",
        "ai: AIClientService «ACL»\ngrade / generateFeedback /\nanalyzeWeaknesses\n(timeout + fallback, sin breaker)",
    ]
    xs = [60, 600, 1140, 1680, 2220]
    for x, c in zip(xs, apps):
        d.box(x, 510, 420, 410, c, C_APP[0], C_APP[1], fontsize=10, align="left", valign="top")

    # DOMINIO
    dom = [
        ("users", False, "User «AggregateRoot»\n+ Role «VO»\nport: IUserRepository"),
        ("auth", False, "Session «Entity»\nEmailVerificationToken*\nPasswordResetToken*\nisExpired/isUsed/markUsed\nports: IAuthRepository,\nIPasswordResetTokenRepository\nITokenService/IOAuthVerifier"),
        ("quiz", False, "Quiz «AggregateRoot» ◆─ Question «Composite»\nQuizSession «Entity»\nVO: Category/Difficulty/Language/AIProvider\nport: IQuizRepository, IAIQuestionProvider\nevents: QuizCreated/Started/Completed"),
        ("score", False, "Score «Entity» · Achievement «Entity»\nports: IScoreRepository, IAchievementRepository\nevents: ScoreUpdated, AchievementUnlocked"),
        ("notifications", True, "Notification «Entity»\n(+VO NotificationType)\nSIN port/use-case en codigo"),
        ("feedback", True, "FeedbackIA «Entity»\n(+VO GradingStrategy)\nSIN port/use-case en codigo"),
    ]
    dx = 60
    for name, new, label in dom:
        w = 460 if name in ("quiz",) else 410
        d.box(dx, 980, w, 330, label, C_NEW[0] if new else C_DOM[0], C_NEW[1] if new else C_DOM[1],
              fontsize=10, align="left", valign="top")
        dx += w + 20

    # INFRAESTRUCTURA
    infra = [
        "TypeORM Repos «Repository/Adapter»:\nUserRepository, AuthRepository,\nPasswordResetTokenRepository,\nQuizRepository, ScoreRepository,\nAchievementRepository",
        "Auth infra «Strategy»:\nJwtTokenService,\nGoogleOAuthVerifier,\nMicrosoftOAuthVerifier,\nOAuthVerifierRegistry «Factory»",
        "Quiz IA infra «Strategy»:\nQwenProvider, MistralProvider\n(BaseOllamaAIProvider «Template Method»)\nAIProviderFactory «Factory»",
        "Cache «Proxy»: @nestjs/cache-manager\n(notifications/feedback: sin repo TypeORM,\nsolo entidad registrada)",
    ]
    xs = [60, 760, 1380, 2000]
    ws = [680, 600, 600, 660]
    for x, w, c in zip(xs, ws, infra):
        d.box(x, 1370, w, 280, c, C_INF[0], C_INF[1], fontsize=10, align="left", valign="top")

    d.legend(60, 90, [], w=10, title="")  # placeholder (no usar)
    d.note(2180, 130, 480, 80, "* Entidades nuevas por RF (magenta). NotificationsModule y FeedbackModule "
                               "solo tienen entidad/tabla; su logica esta pendiente.")
    return d


# ===================== 5. CASOS DE USO =====================
def casos_uso():
    d = Doc("UC", "Casos de Uso - ProyDemo", w=2400, h=1600)
    d.title("Diagrama de Casos de Uso · actores y casos REALES (sin SMTP/OpenTrivia: no implementados)")
    # actores
    actors = [
        (80, 300, "Estudiante\n(USER)"),
        (80, 620, "Docente\n(TEACHER)"),
        (80, 940, "Administrador\n(ADMIN)"),
        (2150, 300, "Sistema OAuth\n(Google/Microsoft)"),
        (2150, 620, "Servicio IA\n(FastAPI/Ollama)"),
    ]
    aid = {}
    for x, y, label in actors:
        cid = d.box(x, y, 170, 80, label, C_EXT[0], C_EXT[1], bold=True)
        aid[label.split("\n")[0]] = (cid, x, y)
    # casos por paquete
    packs = [
        (360, 120, 560, "AUTH (real)", [
            "Registrarse", "Iniciar sesion (JWT)", "Login OAuth Google/MS",
            "Refrescar token", "Cerrar sesion",
            "Verificar email (stub)", "Solicitar reset password (loguea link)",
            "Restablecer password",
        ]),
        (980, 120, 560, "QUIZ / EVALUACION (real)", [
            "Listar examenes publicados", "Ver examen", "Crear examen (TEACHER)",
            "Editar/Eliminar examen (TEACHER)", "Generar preguntas IA (Qwen/Mistral)",
            "Iniciar sesion de examen", "Responder pregunta (califica IA/local)",
            "Finalizar examen «Saga»", "Ver mi historial", "Ver historial de alumno (TEACHER)",
        ]),
        (1600, 120, 520, "SCORE / GAMIFICACION (real)", [
            "Ver leaderboard", "Ver mi historial de puntajes",
            "Calcular score (auto)", "Desbloquear logros (auto)",
        ]),
        (980, 900, 560, "USERS / ADMIN (real)", [
            "Ver/editar mi perfil", "Listar usuarios (ADMIN)",
            "Crear/editar/desactivar usuario (ADMIN)", "Ver estadisticas (ADMIN)",
            "Listar estudiantes (TEACHER)",
        ]),
        (1600, 760, 520, "IA (FastAPI real)", [
            "Calificar respuesta (/grading/grade)",
            "Generar feedback (/feedback/generate)",
            "Analizar debilidades (/feedback/weaknesses)",
            "Asistente tutor (/assistant/chat)",
        ]),
    ]
    for px, py, pw, ptitle, ucs in packs:
        d.box(px, py, pw, 40 + 46*len(ucs), ptitle + "\n", C_APP[0], C_APP[1],
              bold=True, align="center", valign="top")
        for i, uc in enumerate(ucs):
            d.box(px + 20, py + 46 + i*46, pw - 40, 36, uc, "#FFFFFF", C_APP[1], fontsize=10)
    d.note(360, 1180, 1180, 120,
           "NO incluidos por no estar implementados: envio de email/SMTP (verify-email es stub; "
           "reset solo loguea el link), notificaciones en tiempo real (WS/SSE), modulo Feedback IA "
           "persistente, Open Trivia DB (eliminado del codigo).")
    d.legend(1600, 1180, COLOR_LEGEND, w=520)
    return d


# ===================== 6. SECUENCIAS (Login OAuth + Resolver) =====================
def secuencias():
    d = Doc("SEQ", "Secuencias - ProyDemo", w=2400, h=1700)
    d.title("Diagramas de Secuencia · (A) Login OAuth · (B) Responder + finalizar examen con IA · flujo REAL")
    # ---- A: Login OAuth ----
    d.box(60, 90, 600, 26, "(A) LOGIN OAUTH (Google/Microsoft)", C_PRE[0], C_PRE[1], bold=True)
    cols = [
        ("Next.js\n(Auth.js v5)", C_PRE),
        ("BFF route\n/api/auth/oauth", C_PRE),
        ("NestJS\nAuthController", C_APP),
        ("OAuthLoginUseCase\n«Command»", C_APP),
        ("OAuthVerifier\n«Strategy/Factory»", C_INF),
        ("PostgreSQL\n(users, auth_sessions)", C_INF),
    ]
    xs = []
    x = 80
    for label, col in cols:
        cx = d.lifeline(x, label, col[0], col[1], y=130, bottom=820, w=170)
        xs.append(cx); x += 250
    seq = [
        (0, 1, "redirect + callback id_token", False),
        (1, 2, "POST /auth/oauth {provider, idToken}", False),
        (2, 3, "execute(dto)", False),
        (3, 4, "verify(idToken) «Strategy»", False),
        (4, 3, "perfil OIDC validado", True),
        (3, 5, "find/create user (lazy provision)", False),
        (3, 5, "INSERT auth_sessions (refresh hash)", False),
        (3, 2, "{accessToken, refreshToken}", True),
        (2, 1, "set cookies httpOnly", True),
        (1, 0, "sesion establecida", True),
    ]
    y = 200
    for a, b, lbl, dash in seq:
        d.msg(xs[a], xs[b], y, lbl, dashed=dash)
        y += 52
    d.note(1620, 150, 720, 150,
           "emit «UserLoggedInEvent» (user.logged-in). "
           "NOTA REAL: este evento NO tiene listener en el codigo actual "
           "→ no se crea notificacion ni push WS (modulo notifications es solo entidad).")

    # ---- B: Responder + finalizar ----
    d.box(60, 900, 700, 26, "(B) RESPONDER PREGUNTA + FINALIZAR EXAMEN (Saga + Observer)", C_PRE[0], C_PRE[1], bold=True)
    cols2 = [
        ("Estudiante\nNext.js", C_PRE),
        ("NestJS\nQuizController", C_APP),
        ("SubmitAnswer /\nEndSession UC", C_APP),
        ("AIClientService\n«ACL»", C_APP),
        ("FastAPI\n/grading,/feedback", C_INF),
        ("PostgreSQL", C_INF),
        ("ScoreModule\nQuizCompletedListener", C_APP),
    ]
    xs2 = []
    x = 80
    for label, col in cols2:
        cx = d.lifeline(x, label, col[0], col[1], y=940, bottom=1620, w=170)
        xs2.append(cx); x += 320
    seq2 = [
        (0, 1, "POST /quiz/session/:id/answer", False),
        (1, 2, "execute(dto)", False),
        (2, 3, "grade(answer) [si open_answer]", False),
        (3, 4, "POST /api/v1/grading/grade «Circuit?no: timeout+fallback»", False),
        (4, 3, "{is_correct, score, strategy}", True),
        (2, 5, "append answer (jsonb) en quiz_sessions", False),
        (2, 1, "{isCorrect, score, feedback*}", True),
        (0, 1, "POST /quiz/session/:id/end", False),
        (1, 2, "EndSession «Saga»: UPDATE quiz_sessions", False),
        (2, 6, "emit «QuizCompletedEvent»  «Observer»", False),
        (6, 5, "INSERT scores + achievements", False),
        (6, 6, "emit ScoreUpdated/AchievementUnlocked (sin consumidor)", False),
    ]
    y = 1010
    for a, b, lbl, dash in seq2:
        d.msg(xs2[a], xs2[b], y, lbl, dashed=dash)
        y += 50
    d.note(60, 1500, 900, 130,
           "feedback* = se devuelve question.feedback almacenado; si no existe se intenta /feedback/generate. "
           "NO se persiste en tabla feedback_ia (FeedbackModule no tiene repo/use-case en codigo). "
           "No hay INSERT notifications ni push WS.")
    return d


# ===================== 7. MICROSERVICIOS (C4 Container) =====================
def microservicios():
    d = Doc("C4", "Arquitectura Microservicios C4 - ProyDemo", w=2400, h=1500)
    d.title("Arquitectura de Microservicios (C4 Container) · contenedores y dependencias REALES")
    # Frontend
    d.box(120, 120, 420, 150,
          "Frontend — Next.js 16 + TS\nApp Router · TailwindCSS · Auth.js v5\nRedux Toolkit · Route Handlers (BFF)\n«BFF» «Container/Presentational»",
          C_PRE[0], C_PRE[1], fontsize=11, align="left", valign="top")
    # Backend NestJS
    d.box(820, 100, 800, 560,
          "Backend — NestJS 10 + TS (Hexagonal + Clean + DDD)\n«API Gateway de entrada» «Event-Driven in-process (EventEmitter2)»",
          C_APP[0], C_APP[1], fontsize=12, bold=True, align="center", valign="top")
    mods = [
        ("AuthModule (+OAuth/JWT, verify/reset stub)", False),
        ("UsersModule", False),
        ("QuizModule (genera IA: Qwen/Mistral via Ollama)", False),
        ("ScoreModule (Listener quiz.completed)", False),
        ("AiModule — AIClientService «ACL»", False),
        ("NotificationsModule — solo entidad (sin logica)", True),
        ("FeedbackModule — solo entidad (sin logica)", True),
    ]
    for i, (m, new) in enumerate(mods):
        d.box(850, 160 + i*66, 740, 54, m, C_NEW[0] if new else "#FFFFFF",
              C_NEW[1] if new else C_APP[1], fontsize=10)
    # FastAPI
    d.box(820, 720, 800, 230,
          "Microservicio IA — FastAPI + Python\nRouters montados: grading · feedback · assistant\n"
          "(analytics NO montado) · Ollama via httpx · sentence-transformers (similarity)\n"
          "«Strategy» grading · «RAG NO implementado (sin FAISS/LangChain)»",
          C_INF[0], C_INF[1], fontsize=11, align="left", valign="top")
    # PostgreSQL
    d.box(1780, 100, 520, 360,
          "PostgreSQL 18 — 11 tablas\nusers · auth_sessions · email_verification_tokens* ·\n"
          "password_reset_tokens* · quizzes · questions ·\nquiz_sessions · scores · achievements ·\n"
          "notifications* · feedback_ia*\n(* nuevas por RF)",
          C_INF[0], C_INF[1], fontsize=11, align="left", valign="top")
    # Redis
    d.box(1780, 500, 520, 110,
          "Cache — @nestjs/cache-manager (in-memory por defecto;\nRedis configurado en infra, conexion pendiente)\n«Proxy/Cache-Aside»",
          C_INF[0], C_INF[1], fontsize=10, align="left", valign="top")
    # Ollama
    d.box(820, 1010, 470, 110, "Ollama (local) — modelos qwen3:8b, mistral-nemo, llama3\nGeneracion de preguntas + grading/feedback",
          C_EXT[0], C_EXT[1], fontsize=10, align="left", valign="top")
    # OAuth providers
    d.box(120, 340, 420, 110, "OAuth Providers — Google / Microsoft\nOIDC id_token (verificado por backend) «Strategy»",
          C_EXT[0], C_EXT[1], fontsize=10, align="left", valign="top")
    # edges
    # use coords approximate via invisible anchors: connect boxes by ids — recapture ids
    # (simplificado: edges con texto)
    d.note(1360, 1010, 940, 230,
           "DEPENDENCIAS:\n"
           "Frontend →(REST/JSON, cookies httpOnly)→ NestJS (BFF).\n"
           "NestJS →(OIDC verify)→ OAuth Providers.\n"
           "NestJS QuizModule →(HTTP /api/generate)→ Ollama (preguntas IA).\n"
           "NestJS AIClientService «ACL» →(REST /api/v1)→ FastAPI →(httpx)→ Ollama.\n"
           "NestJS →(TypeORM)→ PostgreSQL (11 tablas) · Cache in-memory.\n"
           "NO HAY: SMTP/Mailer, WebSocket/SSE, Bull, Celery, FAISS/LangChain, Open Trivia DB.")
    d.legend(120, 500, COLOR_LEGEND, w=560)
    return d


# ===================== 8. ESTADOS (entidades) =====================
def estados():
    d = Doc("ST", "Diagrama de Estados - ProyDemo", w=2400, h=1600)
    d.title("Diagrama de Estados «State» · maquinas de estado de entidades reales")

    def machine(x, y, title, states, trans, *, note=None, planned=False):
        col = (C_NEW if planned else C_DOM)
        d.box(x, y, 520, 28, title, col[0], col[1], bold=True)
        ids = []
        for i, s in enumerate(states):
            cid = d.state(x + 30 + (i % 2)*260, y + 50 + (i // 2)*90, 230, 56, s, "#FFFFFF", col[1])
            ids.append(cid)
        for a, b, lbl in trans:
            d.edge(ids[a], ids[b], lbl, style_extra="strokeColor=%s;" % col[1])
        if note:
            d.note(x, y + 50 + ((len(states)+1)//2)*90, 520, 70, note)

    machine(80, 110, "QuizSession (quiz_sessions.status)",
            ["in_progress", "completed", "abandoned"],
            [(0, 1, "EndSession (complete)"), (0, 2, "EndSession (abandon)")],
            note="Disparadores: StartSession crea in_progress; EndSessionUseCase transiciona.")

    machine(700, 110, "Session (auth_sessions)",
            ["ACTIVA", "REFRESCADA", "REVOCADA", "EXPIRADA"],
            [(0, 1, "RefreshToken (rota hash)"), (1, 1, "Refresh"),
             (0, 2, "Logout/ResetPassword (is_revoked=true)"), (0, 3, "expires_at < now")],
            note="is_revoked + expires_at. ResetPassword revoca todas las sesiones.")

    machine(1320, 110, "EmailVerificationToken*",
            ["ACTIVO", "USADO", "EXPIRADO"],
            [(0, 1, "markUsed() / ConfirmVerify"), (0, 2, "isExpired()")],
            planned=True,
            note="used_at + expires_at. VerifyEmail es stub (sin envio real de email).")

    machine(1880, 110, "PasswordResetToken*",
            ["ACTIVO", "USADO", "EXPIRADO"],
            [(0, 1, "ResetPassword markUsed()"), (0, 2, "isExpired() TTL~1h")],
            planned=True,
            note="Identico a verify. Request solo loguea el link (sin SMTP).")

    machine(80, 760, "Notification (notifications)*",
            ["NO_LEIDA", "LEIDA", "ARCHIVADA"],
            [(0, 1, "markAsRead (is_read=true)"), (1, 2, "archivar")],
            planned=True,
            note="Columnas is_read/read_at modeladas. LOGICA NO IMPLEMENTADA (modulo esqueleto). "
                 "No hay ENTREGADA_WS porque no existe WebSocket.")

    machine(700, 760, "FeedbackIA (feedback_ia)*",
            ["GENERADO", "PERSISTIDO", "ENTREGADO"],
            [(0, 1, "INSERT feedback_ia"), (1, 2, "lectura docente/alumno")],
            planned=True,
            note="Tabla con strategy_used/score. PERSISTENCIA NO IMPLEMENTADA en codigo "
                 "(FeedbackModule solo registra la entidad).")
    d.legend(1320, 760, COLOR_LEGEND, w=560)
    return d


# ===================== 9. SECUENCIA CREAR EVALUACION =====================
def crear_eval():
    d = Doc("SEQC", "Secuencia Crear Evaluacion - ProyDemo", w=2200, h=1300)
    d.title("Secuencia · Crear examen + generar preguntas con IA (Qwen/Mistral via Ollama, flujo REAL)")
    cols = [
        ("Docente\nNext.js", C_PRE),
        ("BFF\n/api/quiz, /api/quiz/ai/generate", C_PRE),
        ("NestJS QuizController\n@Roles(TEACHER)", C_APP),
        ("GenerateAIQuestions /\nCreateQuiz UC «Command»", C_APP),
        ("AIProviderFactory\n«Factory/Strategy»", C_INF),
        ("Ollama\n(qwen3:8b / mistral-nemo)", C_EXT),
        ("PostgreSQL\n(quizzes, questions)", C_INF),
    ]
    xs = []
    x = 70
    for label, col in cols:
        cx = d.lifeline(x, label, col[0], col[1], y=120, bottom=1180, w=180)
        xs.append(cx); x += 295
    seq = [
        (0, 1, "Generar preguntas (tema, cantidad, dificultad)", False),
        (1, 2, "POST /quiz/ai/generate (lang forzado 'es')", False),
        (2, 3, "execute(dto)", False),
        (3, 4, "generateWithFallback(opts, Qwen)", False),
        (4, 5, "POST /api/generate (Qwen) «Strategy»", False),
        (5, 4, "JSON preguntas (o falla)", True),
        (4, 5, "fallback → Mistral si Qwen falla «Chain»", False),
        (4, 3, "AIGeneratedQuestion[] (cache 1h «Cache-Aside»)", True),
        (3, 2, "preguntas", True),
        (2, 1, "preguntas generadas", True),
        (0, 1, "Crear examen (titulo, preguntas, publicar)", False),
        (1, 2, "POST /quiz", False),
        (2, 3, "CreateQuiz execute(dto)", False),
        (3, 6, "INSERT quizzes + questions (cascade) «UnitOfWork»", False),
        (3, 2, "emit QuizCreatedEvent (sin consumidor)", True),
        (2, 1, "201 Created {quiz}", True),
        (1, 0, "redirige a /quiz/:id", True),
    ]
    y = 200
    for a, b, lbl, dash in seq:
        d.msg(xs[a], xs[b], y, lbl, dashed=dash)
        y += 54
    d.note(70, 1120, 1100, 90,
           "NOTA REAL: la generacion IA de preguntas la hace el BACKEND directo contra Ollama "
           "(AIProviderFactory→Qwen/Mistral), NO via FastAPI. Idioma forzado a espanol. "
           "Timeout extendido (600s) por cold start de modelos en CPU.")
    return d


# ===================== 10. COMPONENTES =====================
def componentes():
    d = Doc("CMP", "Diagrama de Componentes - ProyDemo", w=2500, h=1600)
    d.title("Diagrama de Componentes · capas Hexagonal por modulo NestJS + FastAPI + datos · solo componentes reales")
    # frontend
    d.box(80, 110, 560, 130,
          "Frontend Next.js (BFF)\nPages/Components «Container/Presentational»\nRedux Toolkit slices «ViewModel»\nRoute Handlers /api/* (proxy) · Auth.js SessionProvider",
          C_PRE[0], C_PRE[1], fontsize=10, align="left", valign="top")

    modules = [
        ("AuthModule", ["Presentacion: AuthController, DTOs",
                         "Aplicacion: 8 UseCases «Command»",
                         "Dominio: Session, EmailVerifToken*, PwdResetToken*, ports",
                         "Infra: AuthRepository, PasswordResetTokenRepo, JwtTokenService, OAuthVerifiers «Strategy»"],
         "users · auth_sessions · email_verification_tokens · password_reset_tokens", False),
        ("UsersModule", ["Presentacion: UsersController",
                         "Aplicacion: (repo directo; UC no cableados)",
                         "Dominio: User «AggregateRoot», Role «VO», IUserRepository",
                         "Infra: UserRepository «Repository»"],
         "users", False),
        ("QuizModule", ["Presentacion: QuizController, DTOs",
                        "Aplicacion: 8 UseCases (EndSession «Saga»)",
                        "Dominio: Quiz◆Question, QuizSession, VOs, IQuizRepository, IAIQuestionProvider",
                        "Infra: QuizRepository, Qwen/Mistral «Strategy», AIProviderFactory «Factory», Cache «Proxy»"],
         "quizzes · questions · quiz_sessions", False),
        ("ScoreModule", ["Presentacion: ScoreController",
                         "Aplicacion: 5 UC + QuizCompletedListener «Observer»",
                         "Dominio: Score, Achievement, ports, events",
                         "Infra: ScoreRepository, AchievementRepository"],
         "scores · achievements", False),
        ("AiModule (@Global)", ["Aplicacion/Infra: AIClientService «ACL/Adapter»",
                                "AiController (proxy feedback/weaknesses)",
                                "HTTP → FastAPI /api/v1 (timeout+fallback, sin breaker)"],
         "(sin tabla)", False),
        ("NotificationsModule*", ["Solo entidad Notification registrada",
                                  "SIN controller/use-cases/gateway",
                                  "Archivos sse/gateway/broadcast: vacios"],
         "notifications", True),
        ("FeedbackModule*", ["Solo entidad FeedbackIA registrada",
                             "SIN controller/use-cases/repo/cache"],
         "feedback_ia", True),
    ]
    x, y = 80, 280
    for i, (name, layers, tables, new) in enumerate(modules):
        col = (C_NEW if new else C_APP)
        bx = 80 + (i % 3) * 800
        by = 280 + (i // 3) * 330
        d.box(bx, by, 760, 30, name, col[0], col[1], bold=True)
        d.box(bx, by + 34, 760, 168, "\n".join("• " + l for l in layers),
              "#FFFFFF", col[1], fontsize=10, align="left", valign="top")
        d.box(bx, by + 206, 760, 40, "Tablas: " + tables, C_INF[0], C_INF[1],
              fontsize=10, align="left", valign="middle")

    # FastAPI component
    d.box(80, 1280, 1100, 150,
          "FastAPI ai-service — Routers: grading (/grade,/batch), feedback (/generate,/weaknesses,/study-plan), "
          "assistant (/chat,/chat/stream,/conversation)\nOllama via httpx · sentence-transformers (similarity) · "
          "PromptBuilder «Builder» · InMemoryConversationRepository\nNO FAISS / NO LangChain / NO Celery / analytics no montado",
          C_INF[0], C_INF[1], fontsize=10, align="left", valign="top")
    d.box(1240, 1280, 1180, 150,
          "EVENT BUS in-process (EventEmitter2):\n"
          "Emitidos: user.logged-in, user.registered, quiz.created, quiz.started, quiz.completed, "
          "score.updated, achievement.unlocked\n"
          "Listener REAL (unico): QuizCompletedListener @OnEvent('quiz.completed') → SaveScore + CheckAchievements\n"
          "El resto de eventos se emiten pero NO tienen consumidor. NO hay WebSocket/SSE ni Bull.",
          C_PAT[0], C_PAT[1], fontsize=10, align="left", valign="top")
    return d


BUILDERS = {
    "02_Diagrama_ER_DER_CORREGIDO.drawio": der,
    "03_Modelo_Relacional.drawio": relacional,
    "04_Diagrama_Normalizacion.drawio": normalizacion,
    "05_Diagrama_Clases_UML.drawio": clases,
    "06_Casos_de_Uso.drawio": casos_uso,
    "07_Diagrama_Secuencias.drawio": secuencias,
    "08_Arquitectura_Microservicios.drawio": microservicios,
    "10_Diagrama_Estados.drawio": estados,
    "12_Secuencia_Crear_Evaluacion.drawio": crear_eval,
    "16_Componentes_v2.drawio": componentes,
}


def main():
    for fname, builder in BUILDERS.items():
        doc = builder()
        xml = doc.save()
        (OUT / fname).write_text(xml, encoding="utf-8")
        print(f"OK {fname} ({len(xml)} bytes)")


if __name__ == "__main__":
    main()
