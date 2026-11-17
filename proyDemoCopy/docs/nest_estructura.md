# NestJS 11 — Estructura de Carpetas

## Tipo de Arquitectura

**MVC + Hexagonal (Ports & Adapters) + Clean Architecture + CQRS + DDD**

| Capa MVC        | Implementación en NestJS                                                         |
|-----------------|----------------------------------------------------------------------------------|
| **Model**       | `domain/entities/` · `domain/value-objects/` · TypeORM entities                 |
| **View**        | DTOs de respuesta + Swagger auto-docs (`@nestjs/swagger`)                        |
| **Controller**  | `presentation/` Controllers (`@Controller`) + Guards + Pipes + Interceptors      |
| **Lógica**      | `application/use-cases/` Services que orquestan casos de uso                     |
| **Persistencia**| `infrastructure/repositories/` TypeORM + Redis (implementan Ports del dominio)  |

**Patrones de Diseño:** Repository · Factory · Observer (@nestjs/event-emitter) · Decorator · Guard · Strategy (Passport) · Facade (Services) · Chain of Responsibility (Pipes+Guards) · Command (Use Cases) · Unit of Work (TypeORM) · Adapter (OpenTrivia client · OllamaClient · cliente HTTP de FastAPI · viem) · Template Method (proveedores Aya, Qwen y Mistral) · Saga (Bull queues)

**Paradigmas:** OOP (clases/decoradores) · Reactivo (RxJS Observable) · Orientado a Eventos (@nestjs/event-emitter) · AOP (Interceptors/Guards) · Async/Await

**Prácticas:** SOLID · DRY · Clean Code · Type-Safe (TS strict + class-validator + Zod) · JWT Auth · RBAC · Rate Limiting · OpenAPI auto-gen · Rutas protegidas (JwtAuthGuard global + @Public() opt-out)

**Tecnologías:** NestJS 11 · TypeScript 5 · TypeORM · PostgreSQL · Redis · Bull · Passport JWT · Swagger OpenAPI · Ollama (Aya, Qwen, Mistral) · viem (Sepolia, sin contratos) · Jest · Supertest · k6 · Artillery · ESLint · Prettier · TypeDoc · MkDocs

---

## Estructura de Carpetas Completa

> Árbol generado desde la matriz `matriz_trazabilidad_tecnica_AulaDeIdiomas (6).xlsx` (hoja «🐈 NestJS», columna «Carpeta / Archivo (FBA)»): ambos documentos listan los mismos archivos con los mismos nombres. La etiqueta `[CREAR | LISTAR | VER DETALLE | EDITAR | ELIMINAR]` indica qué operación CRUD atiende cada archivo; en la matriz no se repiten las carpetas porque ya aparecen en la ruta de cada archivo.

```
apps/backend/                                                           # MVC: View=DTOs+Swagger · Controller=presentation/ · Model=domain/
├── src/                                                                # Código fuente de la aplicación
│   ├── database/
│   │   ├── migrations/                                                 # Migraciones versionadas de TypeORM (RF-80)
│   │   │   ├── 1791980689448-InitialSchema.ts                          # [CREAR] InitialSchema: 21 tablas, enums, índices y FK (up/down reversible)
│   │   │   ├── 1791990000000-ExtendedReviewStatus.ts                   # [CREAR] estados draft · generated · review_required · reviewed · approved · archived (convierte datos)
│   │   │   ├── 1791990100000-CourseOutline.ts                          # [CREAR] course_nodes + course_lesson_items
│   │   │   ├── 1791990200000-CurriculumFlags.ts                        # [CREAR] curriculum_items.flags text[]
│   │   │   ├── 1791990300000-PronunciationAudio.ts                     # [CREAR] pronunciation_audio (índice de la caché de audio)
│   │   │   ├── 1791990400000-LessonProgress.ts                         # Migración
│   │   │   ├── 1791990500000-ReportExports.ts                          # [CREAR] report_exports (exportaciones PDF/Excel asíncronas · Sprint 6.4)
│   │   │   ├── 1791990600000-Payments.ts                               # [CREAR] orders, payments (session_id e idempotency_key únicos) y refunds · Sprint 7.3
│   │   │   ├── 1791990700000-Web3.ts                                   # [CREAR] wallets (address única) y crypto_payments (tx_hash único) · Sprint 7.6
│   │   │   ├── 1791990800000-Certificates.ts                           # [CREAR] certificates (código y anchor_tx_hash únicos; uno por usuario y curso) · Sprint 7.8
│   │   │   ├── 1791990900000-Help.ts                                   # [CREAR] faqs, manual_articles (slug + idioma únicos) y guide_feedback · Sprint 7.10
│   │   │   ├── 1791991000000-Forums.ts                                 # [CREAR] forum_threads y forum_posts (borrado lógico con deleted_at) · Sprint 7.14
│   │   │   ├── 1791991100000-EmailOutbox.ts                            # [CREAR] email_outbox (bandeja de salida pending → sent | failed) · Sprint 7.15
│   │   │   ├── 1791991200000-MagicLink.ts                              # [CREAR] magic_link_tokens (hash único, 15 min, un solo uso) · Sprints 1.5/7.18
│   │   │   ├── 1791991300000-CertificateLevel.ts                       # [CREAR] certificates.cefr_level con relleno desde courses.category · Sprint 7.8
│   │   │   ├── 1791991400000-Phase8LanguageGamesPractice.ts            # [CREAR] vocabulario, consultas, juegos, mazo SM-2, fluidez, escenarios y práctica · Sprints 8.2/8.5/8.12
│   │   │   ├── 1791991500000-Phase9MusicDialogues.ts                   # [CREAR] canciones, líneas, colecciones, diálogos, temas, turnos y conversaciones · Sprints 9.2/9.3
│   │   │   ├── 1791991600000-Phase10PolyglotGrammarDictionary.ts       # [CREAR] vocabulary_entries.status, polyglot_* y grammar_* · Sprints 10.2/10.5/10.9
│   │   │   ├── 1791991700000-PolyglotTopicCategory.ts                  # [CREAR] polyglot_topics.category (select por categoría en /poliglota) · 2026-10-19
│   │   │   ├── 1791991800000-DialogueTurnRecording.ts                  # dialogue_turns.audio_key/audio_mime — grabación de voz del usuario en la conversación con el avatar
│   │   │   ├── 1791991900000-PracticeActivityContents.ts               # practice_activities.contents — contenidos vinculados de otras secciones (vocabulario, juego, canción, diálogo…)
│   │   │   ├── 1791992000000-UserProfilePreferences.ts                 # users.bio / timezone / preferred_language — preferencias del perfil pasan de localStorage a BD
│   │   │   ├── 1791992100000-CourseMaterialKinds.ts                    # course_materials admite audio, documentos y enlaces (columna url)
│   │   │   ├── 1791992200000-GameSettings.ts                           # game_settings = título, descripción y estado editables de cada juego del catálogo (Gestión → Actividades → Juegos)
│   │   │   ├── 1791992300000-UserPhone.ts                              # número de teléfono opcional del usuario (Mi perfil y Gestión → Crear usuario) | `IF NOT EXISTS`: idempotente
│   │   │   ├── 1791992450000-CourseContent.ts                          # contenido del curso en Markdown, separado de la descripción (resumen) | `text` (PostgreSQL): sin límite de longitud prác…
│   │   │   ├── 1791992600000-ReadingTexts.ts                           # tablas reading_texts (texto por género/idioma/nivel), reading_sentences (frase con traducción e IPA) y reading_progress …
│   │   │   ├── 1791992700000-GameDecks.ts                              # game_decks = juegos de vocabulario con material propio (Gestión → Actividades → Juegos → Crear) | `IF NOT EXISTS`: idemp…
│   │   │   ├── 1791992800000-CourseSyllabus.ts                         # ficha del curso separada del temario (objetivos y público) + subtemas estudiados por el alumno (progreso) | `IF NOT EXIS…
│   │   │   ├── 1791992900000-CourseOwner.ts                            # courses.created_by — dueño del curso (el docente gestiona solo los suyos; el admin, todos)
│   │   │   ├── 1791993400000-TutorConversations.ts                     # conversaciones y mensajes del Tutor IA (renombrar/borrar conversación, editar/borrar mensaje, uso del idioma meta)
│   │   │   ├── 1791993500000-UserSocialLinks.ts                        # users.linkedin_url / twitter_url / spotify_url / youtube_url — redes sociales del docente para «Autoría del contenido» d…
│   │   │   ├── 1791993650000-TitleDedup.ts                             # red de seguridad en BD para la regla anti-duplicados por título (shared/application/unique-title) ante carreras (dos alt…
│   │   │   ├── 1791993700000-VocabularyGrammar.ts                      # `grammar` (jsonb) = artículo, género, plural, clasificador… de cada sustantivo | null = pendiente (se completa sola)
│   │   │   ├── 1791993710000-SongEmbedUrl.ts                           # `embed_url` = reproductor oficial (YouTube, Spotify…) de una canción cuyo enlace pegó el docente · el audio no se descar…
│   │   │   ├── 1791993800000-CourseExams.ts                            # quizzes.kind (practice | final | level) + curso, nivel, nota mínima, tiempo total y preguntas por intento · quiz_session…
│   │   │   ├── 1791993900000-CertificateManagement.ts                  # gestión de certificados — notas de auditoría del ADMIN y solicitud de revocación del DOCENTE
│   │   │   ├── 1791994000000-ExamAttemptsTemplate.ts                   # Gestión → Certificados — anular intentos de examen (incidencia técnica, con motivo auditable) y plantilla del PDF (fila …
│   │   │   ├── 1791994100000-AcademicClosure.ts                        # cierre académico del docente (requisito del certificado de curso) + nota final corregida por el docente
│   │   │   ├── 1791994200000-SongTitleGloss.ts                         # songs.title_ipa/title_translation — glosa del título guardada (sin esperar a la IA al abrir la canción)
│   │   │   ├── 1791994300000-PolyglotTopicLanguages.ts                 # polyglot_topics.languages — idiomas que compara el tema (vacío = los siete)
│   │   │   ├── 1791994400000-CourseFavoritesReactions.ts               # ⭐ favorito y 👍/❤️ reacción SALEN de course_enrollments → course_favorites y course_reactions
│   │   │   ├── 1791994500000-DialogueTurnFeedback.ts                   # dialogue_turns.feedback (jsonb) = corrección pedagógica ÚNICA del turno del usuario
│   │   │   ├── 1791994600000-CuratedArticleRules.ts                    # las fichas a/an/the de inglés generadas por IA decían «a antes de consonantes sonoras /
│   │   │   ├── 1791994700000-CertificateVerifyUrl.ts                   # certificates.verify_url — URL pública que codifica el QR, fijada al emitir (no cambia aunque cambie el dominio)
│   │   │   ├── 1791994800000-BooksCatalog.ts                           # books + book_texts · books — ficha de los libros de dominio público vistos en el catálogo (caché de Gutendex, sin texto)
│   │   │   ├── 1791994900000-SongLevelOptional.ts                      # songs.level admite NULL — la canción nace sin nivel y se estima de la letra al cargarla (LevelClassifier)
│   │   │   ├── 1791995000000-TwoFactorOtp.ts                           # users.two_factor_enabled + tabla login_otps (código de un solo uso enviado por correo)
│   │   │   ├── 1791995100000-ReadingKind.ts                            # reading_texts.kind ('reading' | 'dictation') — las lecturas existentes quedan como 'reading'
│   │   │   ├── 1791995200000-PolyglotTermGrammar.ts                    # polyglot_terms.grammar (plural, género, contable, clasificador + pinyin)
│   │   │   └── 1791995300000-BooksWikisource.ts                        # books.source ('gutenberg' | 'wikisource') + books.image_url (portada o imagen de Wikidata)
│   │   └── data-source.ts                                              # DataSource para la CLI de migraciones
│   ├── modules/                                                        # Bounded Contexts (DDD)
│   │   ├── ai/                                                         # Contexto del módulo «AI (Puerta de IA)»
│   │   │   ├── tutor/
│   │   │   │   ├── tutor-conversation.entity.ts                        # conversación del alumno con el Tutor IA (lista lateral con renombrar y borrar)
│   │   │   │   ├── tutor-conversation.service.ts                       # casos de uso del Tutor IA — enviar mensaje, listar/leer/renombrar/borrar conversación y editar/borrar mensaje
│   │   │   │   ├── tutor-conversations.controller.ts                   # CRUD de las conversaciones del Tutor IA — listar, leer, renombrar y borrar conversación; editar (regenera la respuesta) …
│   │   │   │   ├── tutor-message.entity.ts                             # turno de una conversación del Tutor IA (editar/borrar mensaje)
│   │   │   │   └── tutor-sse.ts                                        # respuesta ya guardada del Tutor IA → flujo SSE (session · token por palabra · saved · done)
│   │   │   ├── ai-client.service.ts                                    # Cliente HTTP hacia FastAPI (/api/v1) con timeout y propagación del JWT
│   │   │   ├── ai-response.dto.ts                                      # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): retroalimentación, recomendaciones y estado de la puerta de IA; esquema de respuesta en Swagger
│   │   │   ├── ai.controller.ts                                        # [CREAR, LISTAR, VER DETALLE] Endpoints REST, guards de rol y validación de DTOs
│   │   │   ├── ai.module.ts                                            # Composición DI del bounded context
│   │   │   ├── assistant-client.service.ts                             # AssistantClient: único cliente hacia FastAPI /assistant/chat (persona guide, game o dialogue) y /assistant/knowledge, con JWT propagado; lo usan Help, Games y Dialogues (DRY)
│   │   │   ├── assistant.controller.ts                                 # proxy NestJS → tutor RAG de FastAPI
│   │   │   ├── ollama.client.ts                                        # OllamaClient: único cliente HTTP de Ollama (generate, show, ps), métricas y traducción de errores; lo reutilizan Quiz, Curriculum, Practice, Polyglot y Grammar
│   │   │   ├── own-llm-response.dto.ts                                 # [CREAR, LISTAR] [Sprint 11.2] DTO de salida (@ApiProperty): errores marcados, corrección, explicación y alcance del LLM propio; esquema de respuesta en Swagger
│   │   │   ├── own-llm.controller.ts                                   # [CREAR, LISTAR] POST /ai/own-llm/writing-corrections + GET /ai/own-llm/scope (DTO class-validator; proxy a FastAPI)
│   │   │   └── own-llm-client.service.ts                               # OwnLlmClient: único cliente hacia FastAPI POST /own-llm/correct y GET /own-llm/scope con JWT propagado; el LLM propio (RF-144) vive completo en FastAPI
│   │   ├── audio/                                                      # Contexto: Audio de pronunciación con caché (RF-55)
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                   # DTOs (class-validator)
│   │   │   │   │   └── audio-response.dto.ts               # [CREAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): audio de pronunciación (clave, idioma, acento y duración); esquema de respuesta en Swagger
│   │   │   │   └── use-cases/
│   │   │   │       ├── get-audio.use-case.ts                           # [CREAR] devuelve el audio cacheado o lo genera una sola vez (Command, SRP)
│   │   │   │       └── invalidate-audio.use-case.ts                    # [ELIMINAR] invalida un audio (ADMIN) (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── pronunciation-audio.entity.ts                   # Tabla TypeORM / entidad de dominio (pronunciation_audio: texto, idioma, acento, clave y ruta en MinIO)
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── audio-storage.interface.ts                      # AudioStoragePort (objeto en MinIO)
│   │   │   │   │   └── speech-synthesis.interface.ts                   # SpeechSynthesisPort (voz local)
│   │   │   │   ├── audio-key.ts                                        # clave de caché sha256 (texto, idioma, variante, motor) y rangos HTTP 206
│   │   │   │   └── wav-audibility.ts                                   # ¿el WAV que devolvió el motor de voz tiene muestras y SUENA? (RMS/pico sobre el PCM)
│   │   │   ├── infrastructure/
│   │   │   │   ├── speech/
│   │   │   │   │   └── language-tools-speech.adapter.ts                # voz de espeak-ng mediante FastAPI LanguageTools /language-tools/speak (sin dependencias nuevas)
│   │   │   │   └── storage/
│   │   │   │       └── object-audio.storage.ts                         # [Sprint 6.7] ObjectAudioStorage: guarda y sirve el audio en el almacén de objetos (disco, MinIO o R2) con Range 206
│   │   │   ├── presentation/
│   │   │   │   └── audio.controller.ts                                 # [CREAR, VER DETALLE, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── audio.module.ts                                         # Composición DI del bounded context
│   │   ├── auth/                                                       # Contexto: Autenticación y Autorización
│   │   │   ├── application/                                            # Capa Aplicación — casos de uso (SRP)
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── auth-response.dto.ts                            # [CREAR, EDITAR] DTO salida: accessToken, refreshToken, user
│   │   │   │   │   ├── forgot-password.dto.ts                          # Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── login.dto.ts                                    # [CREAR] DTO entrada: email, password
│   │   │   │   │   ├── oauth-login.dto.ts                              # [CREAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── refresh.dto.ts                                  # [EDITAR] DTO entrada: refreshToken string
│   │   │   │   │   ├── register.dto.ts                                 # [CREAR] DTO entrada: email, password, name (class-validator)
│   │   │   │   │   ├── request-verify-email.dto.ts                     # [CREAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   └── reset-password.dto.ts                           # [EDITAR] Contrato de entrada/salida (class-validator)
│   │   │   │   ├── mail/
│   │   │   │   │   └── link-email.ts                                   # correo con enlace (restablecer contraseña y verificar correo) + escapeHtml (DRY)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── issue-login-otp.use-case.ts                     # segundo factor por código OTP (6 dígitos) enviado al correo
│   │   │   │       ├── login.use-case.ts                               # [CREAR] UC: verificar creds + emitir JWT pair
│   │   │   │       ├── logout.use-case.ts                              # [ELIMINAR] UC: invalidar token + limpiar sesión
│   │   │   │       ├── oauth-login.use-case.ts                         # [CREAR] UC: verifica id_token; si el usuario no existe lo crea CreateUserUseCase (Users)
│   │   │   │       ├── refresh-token.use-case.ts                       # [EDITAR] UC: rotar refresh token en BD
│   │   │   │       ├── register.use-case.ts                            # [CREAR] UC: registro público; el User lo crea CreateUserUseCase (Users) + sesión + par JWT + evento
│   │   │   │       ├── request-magic-link.use-case.ts                  # [CREAR] request magic link (Command, SRP)
│   │   │   │       ├── request-password-reset.use-case.ts              # [CREAR] request password reset (Command, SRP)
│   │   │   │       ├── request-verify-email.use-case.ts                # [CREAR] token de un solo uso + envía el enlace por IMailService (SMTP o log)
│   │   │   │       ├── reset-password.use-case.ts                      # [EDITAR] reset password (Command, SRP)
│   │   │   │       ├── two-factor.use-cases.ts                         # canje del código OTP y activación del segundo factor
│   │   │   │       ├── verify-email.use-case.ts                        # [EDITAR] UC: validar token de verificación
│   │   │   │       └── verify-magic-link.use-case.ts                   # [EDITAR] verify magic link (Command, SRP)
│   │   │   ├── domain/                                                 # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── email-verification-token.entity.ts              # Tabla TypeORM / entidad de dominio (email verification token)
│   │   │   │   │   ├── login-otp.entity.ts                             # código OTP de 6 dígitos enviado por correo como segundo factor del login
│   │   │   │   │   ├── magic-link-token.entity.ts                      # Tabla TypeORM / entidad de dominio (magic_link_token)
│   │   │   │   │   ├── password-reset-token.entity.ts                  # Tabla TypeORM / entidad de dominio (password reset token)
│   │   │   │   │   └── session.entity.ts                               # Entidad: sesión activa por dispositivo
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   ├── user-logged-in.event.ts                         # Evento dominio: login exitoso
│   │   │   │   │   └── user-registered.event.ts                        # Evento dominio: nuevo usuario creado
│   │   │   │   ├── interfaces/                                         # Ports (DIP)
│   │   │   │   │   ├── email-verification-token.repository.interface.ts
│   │   │   │   │   ├── email-verification-token.repository.interface.ts# [CREAR, EDITAR] Interfaz de dominio (DIP) email verification token repository
│   │   │   │   │   ├── mail.service.interface.ts                       # Interfaz de dominio (DIP) mail service
│   │   │   │   │   ├── oauth-verifier.interface.ts                     # Interfaz de dominio (DIP) oauth verifier
│   │   │   │   │   ├── password-reset-token.repository.interface.ts    # [CREAR, EDITAR] Interfaz de dominio (DIP) password reset token repository
│   │   │   │   │   ├── session.repository.interface.ts                 # [CREAR, EDITAR, ELIMINAR] Port (DIP): crear, buscar, revocar y purgar sesiones
│   │   │   │   │   └── token.service.interface.ts                      # Port (DIP): sign + verify JWT
│   │   │   │   └── value-objects/                                      # Value Objects
│   │   │   │       ├── hashed-password.vo.ts                           # VO: password hasheada inmutable
│   │   │   │       └── token-pair.vo.ts                                # TokenPair: par access + refresh inmutable
│   │   │   ├── infrastructure/                                         # Capa Infraestructura — Adapters concretos
│   │   │   │   ├── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │   │   ├── email-verification-token.repository.ts          # [CREAR, EDITAR] Implementación TypeORM del puerto
│   │   │   │   │   ├── password-reset-token.repository.ts              # [CREAR, EDITAR] Implementación TypeORM del puerto
│   │   │   │   │   └── session.repository.ts                           # [CREAR, EDITAR, ELIMINAR] Impl TypeORM de session.repository.interface
│   │   │   │   ├── services/                                           # Adapters / servicios de infraestructura
│   │   │   │   │   ├── google-oauth.verifier.ts                        # google oauth verifier
│   │   │   │   │   ├── jwt-token.service.ts                            # jwt token service
│   │   │   │   │   ├── microsoft-oauth.verifier.ts                     # microsoft oauth verifier
│   │   │   │   │   ├── oauth-verifier.registry.ts                      # oauth verifier registry
│   │   │   │   │   └── smtp-mail.service.ts                            # smtp mail service
│   │   │   │   └── strategies/                                         # Estrategias de Passport
│   │   │   │       ├── jwt.strategy.ts                                 # Adapter: Passport JWT → port TokenService
│   │   │   │       └── local.strategy.ts                               # Adapter: Passport Local para login form
│   │   │   ├── presentation/                                           # Capa Presentación — Controllers
│   │   │   │   ├── auth.controller.ts                                  # [CREAR, EDITAR, ELIMINAR] Rutas públicas: POST /auth/register, /login, /refresh
│   │   │   │   └── magic-link.controller.ts                            # [CREAR, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── auth.module.ts                                          # Módulo: providers, imports, exports
│   │   ├── books/
│   │   │   ├── application/
│   │   │   │   ├── book-language.use-case.ts                           # IPA de la frase + renglones (texto → IPA) para mostrarla renglón a renglón
│   │   │   │   ├── book-progress.use-case.ts                           # guarda y lee dónde se quedó el usuario en un libro (capítulo, párrafo, frase)
│   │   │   │   ├── book-text.use-case.ts                               # índice de capítulos y páginas de un libro · el texto se descarga SOLO cuando un usuario abre el libro
│   │   │   │   └── search-books.use-case.ts                            # búsqueda por título o autor con filtro de idioma y de dominio público (Colombia)
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── book-progress.entity.ts                         # dónde se quedó cada usuario en cada libro (capítulo, párrafo y frase) | una fila por par → upsert
│   │   │   │   │   ├── book-text.entity.ts                             # texto LIMPIO de un libro ya descargado (sin licencia), dividido en capítulos y párrafos
│   │   │   │   │   ├── book-translation.entity.ts                      # traducción de UN párrafo, calculada bajo demanda y guardada por (libro, capítulo, párrafo, idioma)
│   │   │   │   │   └── book.entity.ts                                  # ficha de un libro ya visto en el catálogo (caché en PostgreSQL de Gutendex) — sin el texto
│   │   │   │   ├── book-catalog.port.ts                                # catálogo de libros de dominio público sin que el caso de uso conozca Gutendex
│   │   │   │   ├── book.ts                                             # libro del catálogo de dominio público (Project Gutenberg vía Gutendex) y sus reglas puras
│   │   │   │   ├── clauses.ts                                          # parte una frase larga en renglones cortos (cláusulas) para mostrar la IPA renglón a renglón
│   │   │   │   ├── gutenberg-text.ts                                   # texto plano de Project Gutenberg → sin encabezado ni pie de licencia → capítulos → párrafos → frases
│   │   │   │   └── wikisource.ts                                       # reglas puras para leer Wikisource (textos de dominio público en el idioma ORIGINAL, con géneros por categorías)
│   │   │   ├── infrastructure/
│   │   │   │   ├── books-catalog.adapter.ts                            # UN catálogo para el caso de uso con dos fuentes
│   │   │   │   ├── gutendex.adapter.ts                                 # BookCatalogPort sobre la API JSON de Gutendex (catálogo de Project Gutenberg)
│   │   │   │   └── wikisource.adapter.ts                               # catálogo y texto de Wikisource (API de MediaWiki) + autores y fechas de Wikidata
│   │   │   ├── presentation/
│   │   │   │   └── books.controller.ts                                 # GET /books (buscar) · GET /books/:id (ficha) | sesión obligatoria (JwtAuthGuard global)
│   │   │   └── books.module.ts                                         # catálogo de libros de dominio público (RF-145)
│   │   ├── certificates/                                               # Contexto del módulo «Certificates (Certificados)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── certificate-response.dto.ts                     # [CREAR, LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): certificado (código, nivel MCER, hash SHA-256 y hash de anclaje); esquema de respuesta en Swagger
│   │   │   │   │   └── verify-certificate-response.dto.ts              # [VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): resultado público de verificar un código y su hash; esquema de respuesta en Swagger
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── issue-certificate.use-case.ts                   # [CREAR] emitir certificado al completar el 100 % (Command, SRP)
│   │   │   │       ├── manage-certificates.use-case.ts                 # Gestión → Certificados — bandeja con filtros, detalle, metadatos (ADMIN) y solicitud de revocación (DOCENTE)
│   │   │   │       ├── revoke-certificate.use-case.ts                  # [EDITAR] revocar certificado (Command, SRP)
│   │   │   │       └── verify-certificate.use-case.ts                  # [VER DETALLE] verificar código y hash (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── certificate-template.entity.ts                  # fila única (id = 1) con los textos del PDF que configura el ADMIN | misma tabla que la migración ExamAttemptsTemplate
│   │   │   │   │   └── certificate.entity.ts                           # Tabla TypeORM / entidad de dominio (certificate; guarda el hash SHA-256 del PDF y el hash de la transacción de anclaje)
│   │   │   │   └── interfaces/
│   │   │   │       └── document-renderer.interface.ts                  # Interfaz de dominio (CertificateRendererPort); la implementa CertificatePdfRenderer (infrastructure/pdf/)
│   │   │   ├── infrastructure/
│   │   │   │   └── pdf/                                                # Generación del PDF
│   │   │   │       ├── certificate-pdf.renderer.ts                     # CertificatePdfRenderer (pdfmake con su nodo QR nativo, sin librería extra): PDF con código de verificación y QR; calcula el hash SHA-256 con crypto
│   │   │   │       └── certificate-qr.ts                               # QR vectorial (SVG) de la URL pública de verificación, pintado con el color profundo del nivel MCER
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   └── certificates.controller.ts                          # [CREAR, LISTAR, VER DETALLE, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── certificates.module.ts                                  # Composición DI del bounded context
│   │   ├── courses/                                                    # Contexto del módulo «Courses»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── course-engagement.dto.ts                        # entrada validada y salida tipada de favoritos y reacciones
│   │   │   │   │   ├── course-filter.dto.ts                            # [LISTAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── course-response.dto.ts                          # [LISTAR, VER DETALLE] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── create-course.dto.ts                            # [CREAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── set-published.dto.ts                            # [EDITAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   └── update-course.dto.ts                            # [EDITAR] Contrato de entrada/salida (class-validator)
│   │   │   │   ├── policies/
│   │   │   │   │   ├── course-exam.policy.ts                           # un curso solo se publica con examen final (da el certificado)
│   │   │   │   │   ├── course-ownership.policy.ts                      # ¿puede este usuario GESTIONAR (editar, publicar, borrar, adjuntar material) el curso?
│   │   │   │   │   └── course-title.policy.ts                          # no se repiten cursos con el mismo título (normalizado: sin tildes, mayúsculas ni signos) en el mismo idioma (grupo) + ni…
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── admin-list-courses.use-case.ts                  # [LISTAR] admin list courses (Command, SRP)
│   │   │   │       ├── course-engagement.use-case.ts                   # ⭐ Favorito y 👍/❤️ Reacción de un usuario en un curso — sustituye a ToggleFavoriteUseCase y ToggleReactionUseCase
│   │   │   │       ├── course-materials.use-case.ts                    # [CREAR] course materials (Command, SRP)
│   │   │   │       ├── create-course.use-case.ts                       # [CREAR] create course (Command, SRP)
│   │   │   │       ├── delete-course.use-case.ts                       # [ELIMINAR] delete course (Command, SRP)
│   │   │   │       ├── draft-course.use-case.ts                        # BORRADOR de curso para el formulario de Gestión; NO guarda nada (el administrador revisa y guarda)
│   │   │   │       ├── get-course.use-case.ts                          # [VER DETALLE] get course (Command, SRP)
│   │   │   │       ├── list-courses.use-case.ts                        # [LISTAR] list courses (Command, SRP)
│   │   │   │       ├── purchase-course.use-case.ts                     # [CREAR] purchase course (Command, SRP)
│   │   │   │       ├── set-published.use-case.ts                       # [EDITAR] set published (Command, SRP)
│   │   │   │       ├── toggle-favorite.use-case.ts                     # [EDITAR] toggle favorite (Command, SRP)
│   │   │   │       ├── toggle-reaction.use-case.ts                     # [VER DETALLE] toggle reaction (Command, SRP)
│   │   │   │       └── update-course.use-case.ts                       # [EDITAR] update course (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── course-enrollment.entity.ts                     # Tabla TypeORM / entidad de dominio (course enrollment)
│   │   │   │   │   ├── course-favorite.entity.ts                       # ⭐ Favorito = el usuario GUARDA el curso para volver a él (privado, sin conteo público)
│   │   │   │   │   ├── course-material.entity.ts                       # Tabla TypeORM / entidad de dominio (course material)
│   │   │   │   │   ├── course-reaction.entity.ts                       # 👍 Me gusta (valoración positiva) o ❤️ Me encanta (alta satisfacción) — EXCLUYENTES
│   │   │   │   │   └── course.entity.ts                                # Tabla TypeORM / entidad de dominio (course)
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   ├── course-completed.event.ts                       # el alumno llegó al 100 % del curso → Quiz prepara el examen final
│   │   │   │   │   └── course-enrolled.event.ts                        # course enrolled
│   │   │   │   ├── interfaces/                                         # Ports (DIP)
│   │   │   │   │   ├── course-engagement.repository.interface.ts       # favoritos y reacciones FUERA de la inscripción
│   │   │   │   │   ├── course.repository.interface.ts                  # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Interfaz de dominio (DIP) course repository
│   │   │   │   │   └── file-storage.interface.ts                       # Interfaz de dominio (DIP) file storage
│   │   │   │   └── value-objects/                                      # Value Objects
│   │   │   │       ├── course-category.vo.ts                           # course category
│   │   │   │       └── course-price.vo.ts                              # course price
│   │   │   ├── infrastructure/
│   │   │   │   ├── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │   │   ├── course-engagement.repository.ts                 # implementación PostgreSQL del puerto
│   │   │   │   │   └── course.repository.ts                            # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Implementación TypeORM del puerto
│   │   │   │   ├── seeds/                                              # Datos semilla
│   │   │   │   │   └── language-courses.seed.ts                        # Datos iniciales de cursos por idioma
│   │   │   │   └── storage/                                            # Almacenamiento de archivos (Adapter)
│   │   │   │       ├── local-file.storage.ts                           # Almacenamiento de archivos en disco (sobre LocalObjectStore)
│   │   │   │       └── s3-file.storage.ts                              # [Sprint 6.7] S3FileStorage: materiales en el bucket S3 (MinIO en desarrollo, Cloudflare R2 en producción) sobre el ObjectStore «course-materials»; URL firmada corta y lectura por rango (Range 206)
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── course-materials.controller.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── courses.controller.ts                               # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── me-favorites.controller.ts                          # GET /me/favorites — «Mis favoritos» del usuario con sesión, paginado en el SERVIDOR
│   │   │   └── courses.module.ts                                       # Composición DI del bounded context
│   │   ├── curriculum/                                                 # Contexto del módulo «Curriculum»
│   │   │   ├── application/                                            # Capa Aplicación — casos de uso (SRP)
│   │   │   │   ├── commands/
│   │   │   │   │   ├── bulk-publish.command.ts                         # publica (o despublica) MUCHOS recursos en UNA petición HTTP — p. ej. un tema de vocabulario de 69 palabras importado de …
│   │   │   │   │   ├── change-review-status.command.ts                 # [EDITAR] change review status
│   │   │   │   │   ├── complete-lesson.command.ts                      # el estudiante marca la lección como completada y recibe la siguiente de la línea de tiempo
│   │   │   │   │   ├── create-curriculum-item.command.ts               # [CREAR] create curriculum item
│   │   │   │   │   ├── create-source.command.ts                        # [CREAR] create source
│   │   │   │   │   ├── create-topic.command.ts                         # [CREAR] create topic
│   │   │   │   │   ├── delete-curriculum-item.command.ts               # [ELIMINAR] delete curriculum item
│   │   │   │   │   ├── fill-lesson-gap.command.ts                      # [CREAR] genera SOLO si la lección está vacía (existente → caché → LLM); nace GENERATED
│   │   │   │   │   ├── save-course-outline.command.ts                  # [CREAR] estructura primero: guarda el árbol y reutiliza los recursos existentes
│   │   │   │   │   ├── scan-contradictions.command.ts                  # [EDITAR] compara fuentes de un idioma, marca y limpia la bandera (POST /curriculum/contradictions/scan)
│   │   │   │   │   └── update-curriculum-item.command.ts               # [EDITAR] update curriculum item
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── course-outline-response.dto.ts                  # [VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): árbol Nivel → Módulo → Unidad → Lección con recursos y huecos; esquema de respuesta en Swagger
│   │   │   │   │   ├── course-outline.dto.ts                           # [CREAR] esquema anidado Nivel → Módulo → Unidad → Lección (class-validator)
│   │   │   │   │   ├── curriculum-item-response.dto.ts                 # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): recurso del currículo con estado de revisión y procedencia; esquema de respuesta en Swagger
│   │   │   │   │   └── curriculum-item.dto.ts                          # Contrato de entrada/salida (class-validator)
│   │   │   │   ├── queries/
│   │   │   │   │   ├── ai-draft.queries.ts                             # ai draft
│   │   │   │   │   ├── catalog.queries.ts                              # catalog
│   │   │   │   │   ├── certification-practice.query.ts                 # [CREAR] ítems ORIGINALES de preparación (no se guardan) con instrucción de originalidad
│   │   │   │   │   ├── export-curriculum.query.ts                      # descarga TODO el contenido filtrado (p. ej. un tema) en PDF, Word, Excel o CSV — antes solo había una plantilla CSV vací…
│   │   │   │   │   ├── get-course-outline.query.ts                     # [VER DETALLE] árbol del curso con recursos por lección y huecos (estudiantes: solo aprobados)
│   │   │   │   │   ├── get-curriculum-item.query.ts                    # [VER DETALLE] get curriculum item
│   │   │   │   │   └── list-curriculum-items.query.ts                  # [LISTAR] list curriculum items
│   │   │   │   ├── curriculum-actor.ts                                 # curriculum-actor
│   │   │   │   ├── duplicate-headline.ts                               # un tema admite VARIOS elementos (palabras, reglas, frases…) pero no dos con el mismo titular normalizado
│   │   │   │   ├── resolve-catalog-refs.ts                             # resolve-catalog-refs
│   │   │   │   └── topic-labels.ts                                     # Nombre del tema en el idioma: leer, guardar y sugerir con IA ("La ropa" → "Clothes" /kləʊðz/ · sustantivo)
│   │   │   ├── domain/                                                 # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── content/
│   │   │   │   │   ├── curriculum-content.schema.ts                    # Esquemas Zod del contenido y coherencia de idioma
│   │   │   │   │   ├── grammar-templates.ts                            # reglas con ejemplos verificados en lugar de reglas libres de un modelo pequeño
│   │   │   │   │   ├── vocabulary-article.ts                           # qué artículos admite cada idioma y cuándo es obligatorio
│   │   │   │   │   └── vocabulary-grammar.ts                           # funciones PURAS que completan una ficha de vocabulario con artículo, género, plural y clasificador
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── course-node.entity.ts                           # course_nodes: Curso → Nivel → Módulo → Unidad → Lección en una tabla (Composite) + course_lesson_items
│   │   │   │   │   ├── curriculum-generation.entity.ts                 # Tabla TypeORM / entidad de dominio (curriculum generation)
│   │   │   │   │   ├── curriculum-item-revision.entity.ts              # Tabla TypeORM / entidad de dominio (curriculum item revision)
│   │   │   │   │   ├── curriculum-item.entity.ts                       # Tabla TypeORM / entidad de dominio (curriculum item)
│   │   │   │   │   ├── curriculum-source.entity.ts                     # Tabla TypeORM / entidad de dominio (curriculum source)
│   │   │   │   │   ├── curriculum-topic-label.entity.ts                # Entity CurriculumTopicLabel: nombre del tema en el idioma del recurso ("La ropa" → "Clothes") con su pronunciación y tipo de palabra
│   │   │   │   │   ├── curriculum-topic.entity.ts                      # Tabla TypeORM / entidad de dominio (curriculum topic)
│   │   │   │   │   └── lesson-progress.entity.ts                       # qué lecciones completó cada estudiante → línea de tiempo y «siguiente lección»
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   ├── curriculum-items-changed.event.ts               # uno o más recursos del temario se crearon, editaron, cambiaron de estado o se borraron
│   │   │   │   │   └── curriculum-reviewed.event.ts                    # curriculum reviewed
│   │   │   │   ├── interfaces/                                         # Ports (DIP)
│   │   │   │   │   ├── course-outline.repository.interface.ts          # [CREAR, VER DETALLE] ICourseOutlineRepository (estructura del curso)
│   │   │   │   │   ├── curriculum-llm.interface.ts                     # Interfaz de dominio (DIP) curriculum llm
│   │   │   │   │   └── curriculum.repository.interface.ts              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Interfaz de dominio (DIP) curriculum repository
│   │   │   │   ├── value-objects/                                      # Value Objects
│   │   │   │   │   ├── course-node-type.vo.ts                          # tipo de nodo y regla de jerarquía (childTypeOf)
│   │   │   │   │   ├── curriculum-item-kind.vo.ts                      # curriculum item kind
│   │   │   │   │   ├── provenance.vo.ts                                # provenance
│   │   │   │   │   └── review-status.vo.ts                             # [EDITAR] review status
│   │   │   │   ├── certifications.ts                                   # Cambridge, DELF/DALF, Goethe, DELE, Celpe-Bras, HSK, TORFL (especificaciones públicas; MCER oficial u orientativo)
│   │   │   │   ├── course-outline.ts                                   # aplanar el esquema y armar el árbol con huecos (flattenOutline, buildTree, summarize)
│   │   │   │   ├── headline.ts                                         # titular normalizado del contenido (lo usan IA, jerarquía y comparación de fuentes)
│   │   │   │   ├── pronunciation-media.ts                              # imagen o video de la BOCA para «Cómo se pronuncia» (fichas de pronunciación)
│   │   │   │   ├── slug.ts                                             # slug
│   │   │   │   └── source-comparison.ts                                # alineación por titular, reglas por campo y bandera CONTRADICCION_DETECTADA
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── knowledge-index-sync.listener.ts                # cada cambio del temario llega al índice RAG de FastAPI
│   │   │   │   │   └── ollama-curriculum.llm.ts                        # Implementa CurriculumLlm sobre OllamaClient del módulo AI (JSON restringido + métricas)
│   │   │   │   └── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │       ├── course-outline.repository.ts                    # [CREAR, VER DETALLE] Impl TypeORM transaccional del árbol y sus enlaces
│   │   │   │       └── curriculum.repository.ts                        # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Implementación TypeORM del puerto
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── course-outline.controller.ts                        # [CREAR, VER DETALLE] GET/PUT /curriculum/courses/:courseId/outline · POST …/lessons/:lessonId/fill
│   │   │   │   ├── curriculum.controller.ts                            # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── pronunciation-media.controller.ts                   # imagen o video de la boca para «Cómo se pronuncia» (fichas de pronunciación)
│   │   │   └── curriculum.module.ts                                    # Composición DI del bounded context
│   │   ├── dialogues/                                                  # Contexto del módulo «Dialogue (Diálogos y conversación)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── dialogue-response.dto.ts                        # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): diálogo, turnos con IPA y traducción, temas y conversaciones; esquema de respuesta en Swagger
│   │   │   │   │   └── dialogue.dto.ts                                 # Contrato de entrada/salida (class-validator)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── add-turn.use-case.ts                            # [CREAR] agregar un turno a un diálogo o a una conversación (Command, SRP)
│   │   │   │       ├── classify-dialogue-level.use-case.ts             # estimar el nivel CEFR con FastAPI (Command, SRP)
│   │   │   │       ├── confirm-dialogue-level.use-case.ts              # [EDITAR] confirmar o cambiar el nivel estimado (docente) (Command, SRP)
│   │   │   │       ├── delete-dialogue-session.use-case.ts             # [ELIMINAR] borrar una conversación propia (Command, SRP)
│   │   │   │       ├── end-dialogue-session.use-case.ts                # [EDITAR] cerrar la conversación (Command, SRP)
│   │   │   │       ├── get-dialogue-session.use-case.ts                # [VER DETALLE] transcripción de una conversación (Command, SRP)
│   │   │   │       ├── get-dialogue.use-case.ts                        # [VER DETALLE] diálogo con sus turnos, IPA y traducción (Command, SRP)
│   │   │   │       ├── list-dialogue-sessions.use-case.ts              # [LISTAR] listar conversaciones propias (Command, SRP)
│   │   │   │       ├── list-dialogues.use-case.ts                      # [LISTAR] listar diálogos por idioma, nivel y tema (Command, SRP)
│   │   │   │       ├── list-turns.use-case.ts                          # [LISTAR] listar los turnos (Command, SRP)
│   │   │   │       ├── remove-turn.use-case.ts                         # [ELIMINAR] quitar un turno (Command, SRP)
│   │   │   │       ├── start-dialogue-session.use-case.ts              # [CREAR] iniciar una conversación con el avatar (tema, idioma y nivel) (Command, SRP)
│   │   │   │       ├── submit-user-turn.use-case.ts                    # [EDITAR] enviar el turno del usuario y recibir el del avatar (Command, SRP)
│   │   │   │       ├── turn-enricher.ts                                # IPA + traducción de varios turnos en una petición a LanguageTools | archivo propio para cortar el ciclo
│   │   │   │       ├── turn-recording.use-case.ts                      # guarda la GRABACIÓN de voz de un turno del usuario en la conversación con el avatar y la devuelve por rangos
│   │   │   │       ├── update-dialogue.use-case.ts                     # «Editar» de Gestión → Actividades → Diálogos (Next.js) — título, nombres de los hablantes y nivel (los turnos se editan …
│   │   │   │       ├── update-turn.use-case.ts                         # [EDITAR] corregir texto, IPA, traducción o tiempos (Command, SRP)
│   │   │   │       ├── upload-dialogue.use-case.ts                     # [CREAR] subir el diálogo (texto por hablante, audio opcional y licencia) (Command, SRP)
│   │   │   │       ├── draft-dialogue.use-case.ts                      # [CREAR] borrador de diálogo desde URL (guion) o con IA (POST /dialogues/draft) · 2026-10-19
│   │   │   │       └── withdraw-dialogue.use-case.ts                   # [ELIMINAR] retirar un diálogo (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── dialogue-session.entity.ts                      # Tabla TypeORM / entidad de dominio (dialogue_sessions)
│   │   │   │   │   ├── dialogue-topic.entity.ts                        # Tabla TypeORM / entidad de dominio (dialogue_topics)
│   │   │   │   │   ├── dialogue-turn.entity.ts                         # Tabla TypeORM / entidad de dominio (dialogue_turns)
│   │   │   │   │   └── dialogue.entity.ts                              # Tabla TypeORM / entidad de dominio (dialogues)
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   └── dialogue-session-completed.event.ts             # DialogueSessionCompleted: conversación terminada → progreso y logros (Observer)
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── dialogue-agent.interface.ts                     # Interfaz de dominio (DialogueAgentPort)
│   │   │   │   │   ├── level-classifier.interface.ts                   # Interfaz de dominio (LevelClassifierPort)
│   │   │   │   │   └── sentence-corrector.interface.ts                 # el turno del usuario se corrige UNA vez con el corrector pedagógico único
│   │   │   │   └── translation-sanitizer.ts                            # última barrera antes de guardar o mostrar la traducción de un turno — FastAPI ya
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── dialogue-agent-client.adapter.ts                # DialogueAgentClient: persona «dialogue» del AssistantClient único (turnos del avatar)
│   │   │   │   │   ├── level-classifier-client.adapter.ts              # LevelClassifierClient (HTTP hacia FastAPI /level-classifier)
│   │   │   │   │   └── sentence-corrector.adapter.ts                   # implementa el puerto con el cliente ÚNICO del LLM propio (FastAPI /own-llm/corrector)
│   │   │   │   └── seeds/                                              # Datos semilla
│   │   │   │       └── dialogue-topics.seed.ts                         # presentarse, hobbies, rutinas, familia, animales, comida, viajes y cultura
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── dialogue-sessions.controller.ts                     # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── dialogue-topics.controller.ts                       # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── dialogue-turns.controller.ts                        # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── dialogues.controller.ts                             # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── dialogues.module.ts                                     # Composición DI del bounded context
│   │   ├── feedback/                                                   # Contexto del módulo «Feedback (Retroalimentación)»
│   │   │   ├── application/
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       └── save-feedback.use-case.ts                       # [CREAR] save feedback (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   └── feedback-ia.entity.ts                           # Tabla TypeORM / entidad de dominio (feedback ia)
│   │   │   │   └── interfaces/                                         # Ports (DIP)
│   │   │   │       └── feedback.repository.interface.ts                # Interfaz de dominio (DIP) feedback repository
│   │   │   ├── infrastructure/
│   │   │   │   └── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │       └── feedback.repository.ts                          # Implementación TypeORM del puerto
│   │   │   └── feedback.module.ts                                      # Composición DI del bounded context
│   │   ├── forums/                                                     # Contexto del módulo «Forums (Foros)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── forum-post-response.dto.ts                      # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): respuesta de un hilo; esquema de respuesta en Swagger
│   │   │   │   │   └── forum-thread-response.dto.ts                    # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): hilo de una lección (estado, fijado y cerrado); esquema de respuesta en Swagger
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── create-post.use-case.ts                         # [CREAR] responder a un hilo (Command, SRP)
│   │   │   │       ├── create-thread.use-case.ts                       # [CREAR] crear hilo en una lección (Command, SRP)
│   │   │   │       ├── edit-post.use-case.ts                           # [EDITAR] editar o eliminar respuesta (Command, SRP)
│   │   │   │       ├── list-posts.use-case.ts                          # [LISTAR] listar respuestas (Command, SRP)
│   │   │   │       ├── list-threads.use-case.ts                        # [LISTAR] listar hilos por lección (Command, SRP)
│   │   │   │       └── moderate-thread.use-case.ts                     # [EDITAR] cerrar, fijar o eliminar hilo (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   └── entities/                                           # Entidades de dominio
│   │   │   │       ├── forum-post.entity.ts                            # Tabla TypeORM / entidad de dominio (forum_post)
│   │   │   │       └── forum-thread.entity.ts                          # Tabla TypeORM / entidad de dominio (forum_thread)
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── forum-posts.controller.ts                           # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── forum-threads.controller.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── forums.module.ts                                        # Composición DI del bounded context
│   │   ├── games/                                                      # Contexto del módulo «Games (Juegos y fluidez)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── flashcard-state-response.dto.ts                 # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): tarjeta del mazo SM-2 (intervalo, facilidad y próxima fecha); esquema de respuesta en Swagger
│   │   │   │   │   ├── fluency-metric-response.dto.ts                  # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): métricas de fluidez de una ronda oral; esquema de respuesta en Swagger
│   │   │   │   │   ├── game-round-response.dto.ts                      # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): ronda con respuesta, tiempos y evaluación; esquema de respuesta en Swagger
│   │   │   │   │   ├── game-session-response.dto.ts                    # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): sesión de juego y resumen de resultados; esquema de respuesta en Swagger
│   │   │   │   │   ├── role-play-scenario-response.dto.ts              # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): escenario con objetivos y vocabulario; esquema de respuesta en Swagger
│   │   │   │   │   └── speech-response.dto.ts                          # [CREAR] [Sprint 11.2] DTO de salida (@ApiProperty): transcripción con marcas de tiempo y métricas de fluidez; esquema de respuesta en Swagger
│   │   │   │   ├── listeners/                                          # Listeners de eventos de dominio
│   │   │   │   │   └── word-marked-to-learn.listener.ts                # «Aprender» del diccionario agrega la palabra al mazo SM-2 (Sprint 10.2)
│   │   │   │   ├── strategies/                                         # Estrategias de evaluación (Strategy)
│   │   │   │   │   └── game-evaluator.strategy.ts                      # evalúa una ronda según el tipo de juego (juegos cerrados en NestJS; orales en FastAPI)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── add-flashcard.use-case.ts                       # [CREAR] agregar una entrada del banco al mazo (Command, SRP)
│   │   │   │       ├── archive-scenario.use-case.ts                    # [ELIMINAR] archivar escenario (Command, SRP)
│   │   │   │       ├── cancel-game-session.use-case.ts                 # [ELIMINAR] abandonar una sesión en curso (Command, SRP)
│   │   │   │       ├── clear-my-fluency.use-case.ts                    # [ELIMINAR] borrar el historial propio de métricas (Command, SRP)
│   │   │   │       ├── create-scenario.use-case.ts                     # [CREAR] crear escenario con objetivos y vocabulario (Command, SRP)
│   │   │   │       ├── finish-game-session.use-case.ts                 # [EDITAR] cerrar la sesión y calcular puntaje (Command, SRP)
│   │   │   │       ├── game-catalog.use-case.ts                        # catálogo de juegos = tipos del código + ajustes de la BD (título, descripción, estado)
│   │   │   │       ├── game-decks.use-case.ts                          # juegos con material propio — listar, crear, editar/publicar, archivar y BORRADOR de palabras con IA (Ollama local)
│   │   │   │       ├── get-due-flashcards.use-case.ts                  # [LISTAR] tarjetas vencidas hoy (Command, SRP)
│   │   │   │       ├── get-fluency-progress.use-case.ts                # [LISTAR] serie temporal de métricas del usuario (Command, SRP)
│   │   │   │       ├── get-game-session.use-case.ts                    # [VER DETALLE] resumen de resultados de una sesión (Command, SRP)
│   │   │   │       ├── list-my-sessions.use-case.ts                    # [LISTAR] listar sesiones propias (Command, SRP)
│   │   │   │       ├── list-rounds.use-case.ts                         # [LISTAR] listar las rondas de una sesión (Command, SRP)
│   │   │   │       ├── list-scenarios.use-case.ts                      # [LISTAR] listar escenarios por idioma y nivel (Command, SRP)
│   │   │   │       ├── play-agent-turn.use-case.ts                     # [CREAR] turno del agente de juegos: motor determinista en FastAPI, ronda guardada y objetivos de role-play (Command, SRP)
│   │   │   │       ├── record-fluency-metric.use-case.ts               # [CREAR] guardar las métricas de una ronda oral (Command, SRP)
│   │   │   │       ├── remove-flashcard.use-case.ts                    # [ELIMINAR] quitar una tarjeta del mazo (Command, SRP)
│   │   │   │       ├── review-flashcard.use-case.ts                    # [EDITAR] registrar la calidad del recuerdo y reprogramar (Command, SRP)
│   │   │   │       ├── start-game-session.use-case.ts                  # [CREAR] iniciar sesión con juego, lista de vocabulario y dificultad (Command, SRP)
│   │   │   │       ├── submit-round.use-case.ts                        # [CREAR] registrar la respuesta de una ronda con sus tiempos y evaluarla (Command, SRP)
│   │   │   │       └── update-scenario.use-case.ts                     # [EDITAR] editar escenario (Command, SRP)
│   │   │   ├── domain/                                                 # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── flashcard-state.entity.ts                       # Tabla TypeORM / entidad de dominio (flashcard_states)
│   │   │   │   │   ├── fluency-metric.entity.ts                        # Tabla TypeORM / entidad de dominio (fluency_metrics)
│   │   │   │   │   ├── game-deck.entity.ts                             # actividad de JUEGO con material propio — un tipo de juego de vocabulario (flashcards, parejas, bingo…) + sus palabras
│   │   │   │   │   ├── game-round.entity.ts                            # Tabla TypeORM / entidad de dominio (game_rounds)
│   │   │   │   │   ├── game-session.entity.ts                          # Tabla TypeORM / entidad de dominio (game_sessions)
│   │   │   │   │   ├── game-setting.entity.ts                          # ajuste EDITABLE de un juego del catálogo (los 18 tipos siguen en código: GAME_TYPES)
│   │   │   │   │   └── roleplay-scenario.entity.ts                     # Tabla TypeORM / entidad de dominio (roleplay_scenarios)
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   └── game-completed.event.ts                         # GameCompleted: puntaje final → logros en Score (Observer)
│   │   │   │   ├── interfaces/
│   │   │   │   │   └── game-agent.interface.ts                         # Interfaz de dominio (GameAgentPort)
│   │   │   │   ├── game-content.ts                                     # banco propio de tarjetas (con categoría), temas y frases · licencia CC BY 4.0 (Sprint 8.17)
│   │   │   │   ├── game-type.ts                                        # catálogo de tipos de juego (flashcards, memory, bingo, tabú, 20 preguntas, role-play, speed speaking, shadowing…)
│   │   │   │   └── sm2.ts                                              # algoritmo SM-2 (intervalo, facilidad y próxima fecha)
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── game-agent-client.adapter.ts                    # GameAgentClient: persona «game» del AssistantClient único (turnos del agente)
│   │   │   │   │   └── speech-client.adapter.ts                        # SpeechClient: HTTP hacia FastAPI /speech/transcribe y /speech/fluency para las rondas orales (Speech no tenía consumidor)
│   │   │   │   └── seeds/                                              # Datos semilla
│   │   │   │       └── roleplay-scenarios.seed.ts                      # restaurante, entrevista de trabajo, aeropuerto, médico, hotel y reunión
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── flashcard-states.controller.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── fluency-metrics.controller.ts                       # [CREAR, LISTAR, VER DETALLE, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── game-catalog.controller.ts                          # /games/catalog — listar (todos) · editar título/descripción y publicar/despublicar (docente/admin) · eliminar = archivar
│   │   │   │   ├── game-decks.controller.ts                            # /games/decks — juegos de vocabulario con material propio (Gestión → Actividades → Juegos)
│   │   │   │   ├── game-rounds.controller.ts                           # [CREAR, LISTAR, VER DETALLE] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── game-sessions.controller.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── role-play-scenarios.controller.ts                   # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── speech.controller.ts                                # [CREAR] POST /speech/transcribe (multipart, máx. 10 MB) y /speech/fluency hacia FastAPI Speech
│   │   │   └── games.module.ts                                         # Composición DI del bounded context
│   │   ├── grammar/                                                    # Contexto del módulo «Grammar (Gramática)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── grammar-response.dto.ts                         # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): ficha de gramática con secciones y ejemplos (IPA UK/US); esquema de respuesta en Swagger
│   │   │   │   │   └── grammar.dto.ts                                  # Contrato de entrada/salida (class-validator) de fichas, secciones, ejemplos y borrador
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── add-example.use-case.ts                         # [CREAR] agregar un ejemplo con IPA y traducción (Command, SRP)
│   │   │   │       ├── add-section.use-case.ts                         # [CREAR] agregar una sección a la ficha (Command, SRP)
│   │   │   │       ├── enrich-example.use-case.ts                      # [EDITAR] obtener IPA UK y US y la traducción al español (FastAPI) (Command, SRP)
│   │   │   │       ├── generate-topic-draft.use-case.ts                # [CREAR] pedir el borrador de la ficha a Ollama (OllamaClient) y el IPA a FastAPI LanguageTools (Command, SRP)
│   │   │   │       ├── list-sections.use-case.ts                       # [LISTAR] listar las secciones de una ficha (Command, SRP)
│   │   │   │       ├── remove-example.use-case.ts                      # [ELIMINAR] quitar el ejemplo (Command, SRP)
│   │   │   │       ├── remove-section.use-case.ts                      # [ELIMINAR] quitar una sección (Command, SRP)
│   │   │   │       ├── update-example.use-case.ts                      # [EDITAR] corregir el ejemplo (Command, SRP)
│   │   │   │       └── update-section.use-case.ts                      # [EDITAR] editar una sección (Command, SRP)
│   │   │   ├── domain/                                                 # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── grammar-example.entity.ts                       # Tabla TypeORM / entidad de dominio (grammar_examples)
│   │   │   │   │   ├── grammar-section.entity.ts                       # Tabla TypeORM / entidad de dominio (grammar_sections)
│   │   │   │   │   └── grammar-topic.entity.ts                         # Tabla TypeORM / entidad de dominio (grammar_topics)
│   │   │   │   ├── interfaces/
│   │   │   │   │   └── grammar-draft.interface.ts                      # Interfaz de dominio (GrammarDraftPort)
│   │   │   │   └── section-type.ts                                     # tipos de sección: uso, fórmula, negativa, interrogativa, nota y errores comunes
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   └── grammar-draft-client.adapter.ts                 # GrammarDraftClient (borrador con OllamaClient del módulo AI + IPA con FastAPI /language-tools/ipa)
│   │   │   │   └── seeds/                                              # Datos semilla
│   │   │   │       └── grammar-topics.seed.ts                          # Present Simple, Present Continuous y Present Perfect (contenido propio CC BY 4.0) · Sprint 10.15
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── grammar-examples.controller.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── grammar-sections.controller.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── grammar-topics.controller.ts                        # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── grammar.module.ts                                       # Composición DI del bounded context
│   │   ├── health/                                                     # Salud y métricas del servicio
│   │   │   └── health.controller.ts                                    # [LISTAR, VER DETALLE] /health (BD, Redis, FastAPI, Ollama) y /metrics (RF-82)
│   │   ├── help/                                                       # Contexto del módulo «Help (Centro de ayuda)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── faq-response.dto.ts                             # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): pregunta frecuente por categoría, rol e idioma; esquema de respuesta en Swagger
│   │   │   │   │   ├── faq.dto.ts                                      # Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── guide-response.dto.ts                           # [CREAR] [Sprint 11.2] DTO de salida (@ApiProperty): respuesta del Agente Guía con las secciones del manual citadas; esquema de respuesta en Swagger
│   │   │   │   │   └── manual-article-response.dto.ts                  # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): artículo del manual en Markdown y tabla de contenido por rol; esquema de respuesta en Swagger
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── ask-guide.use-case.ts                           # [CREAR] preguntar al Agente Guía con ruta y rol (Command, SRP)
│   │   │   │       ├── create-faq.use-case.ts                          # [CREAR] crear FAQ con categoría, rol e idioma (Command, SRP)
│   │   │   │       ├── delete-conversation.use-case.ts                 # [ELIMINAR] borrar conversación propia (Command, SRP)
│   │   │   │       ├── get-manual-article.use-case.ts                  # [VER DETALLE] obtener artículo en Markdown (Command, SRP)
│   │   │   │       ├── list-faqs.use-case.ts                           # [LISTAR] listar y buscar FAQ (Command, SRP)
│   │   │   │       ├── list-manual.use-case.ts                         # [LISTAR] tabla de contenido por rol (Command, SRP)
│   │   │   │       ├── rate-guide-answer.use-case.ts                   # [EDITAR] valorar respuesta (útil / no útil) (Command, SRP)
│   │   │   │       ├── reindex-manual.use-case.ts                      # [CREAR] leer docs/manual-usuario y reindexar (Command, SRP)
│   │   │   │       └── update-faq.use-case.ts                          # [EDITAR] editar o archivar FAQ (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── faq.entity.ts                                   # Tabla TypeORM / entidad de dominio (faq)
│   │   │   │   │   ├── guide-feedback.entity.ts                        # Tabla TypeORM / entidad de dominio (guide_feedback)
│   │   │   │   │   └── manual-article.entity.ts                        # Tabla TypeORM / entidad de dominio (manual_article)
│   │   │   │   ├── guide-basics.ts                                     # GENERADO por ai-service/scripts/gen_guide_basics_ts.py desde agents/guide_basics.py — no editar a mano
│   │   │   │   └── guide-fallback.ts                                   # respuesta del Agente Guía SIN IA (FastAPI/Ollama caídos) → búsqueda léxica sobre las FAQ publicadas y las secciones del …
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── faqs.controller.ts                                  # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── guide.controller.ts                                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── manual-articles.controller.ts                       # [CREAR, LISTAR, VER DETALLE] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── help.module.ts                                          # Composición DI del bounded context
│   │   ├── music/                                                      # Contexto del módulo «Music (Música y canciones)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── song-collection-response.dto.ts                 # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): colección con sus canciones ordenadas; esquema de respuesta en Swagger
│   │   │   │   │   ├── song-response.dto.ts                            # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): canción con líneas, IPA, traducción, licencia y estado; esquema de respuesta en Swagger
│   │   │   │   │   └── song.dto.ts                                     # Contrato de entrada/salida (class-validator)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── archive-collection.use-case.ts                  # [ELIMINAR] archivar la colección (Command, SRP)
│   │   │   │       ├── caption-timings.service.ts                      # sin tiempos guardados el reproductor los ESTIMA por longitud → el marcador no iba con la voz
│   │   │   │       ├── change-song-status.use-case.ts                  # [EDITAR] enviar a revisión, publicar o rechazar (ADMIN) (Command, SRP)
│   │   │   │       ├── create-collection.use-case.ts                   # [CREAR] crear colección por idioma, nivel o tema (Command, SRP)
│   │   │   │       ├── create-song.use-case.ts                         # [CREAR] crear la canción con idioma, nivel y declaración de licencia (queda en borrador) (Command, SRP)
│   │   │   │       ├── draft-song-lyrics.use-case.ts                   # BORRADOR de letra con IA (idioma, nivel y tema) para el asistente «Subir canción» — no guarda nada: el docente revisa/ed…
│   │   │   │       ├── enrich-song-lines.use-case.ts                   # [EDITAR] pedir traducción al español e IPA de cada línea a FastAPI (Command, SRP)
│   │   │   │       ├── generate-song-practice.use-case.ts              # [CREAR] crear una actividad de práctica a partir de la letra (Command, SRP)
│   │   │   │       ├── get-collection.use-case.ts                      # [VER DETALLE] colección con sus canciones ordenadas (Command, SRP)
│   │   │   │       ├── get-song.use-case.ts                            # [VER DETALLE] canción con sus líneas, IPA y traducción (Command, SRP)
│   │   │   │       ├── import-lyrics-from-url.use-case.ts              # lee la letra de una página pública (Genius, Letras, AZLyrics, blogs…) para el paso «Letra» del asistente — NO guarda nad…
│   │   │   │       ├── list-collections.use-case.ts                    # [LISTAR] listar colecciones (Command, SRP)
│   │   │   │       ├── list-song-lines.use-case.ts                     # [LISTAR] listar las líneas de una canción (Command, SRP)
│   │   │   │       ├── list-song-practices.use-case.ts                 # [LISTAR] listar las actividades generadas de una canción (Command, SRP)
│   │   │   │       ├── list-songs.use-case.ts                          # [LISTAR] listar canciones por idioma, nivel y colección (Command, SRP)
│   │   │   │       ├── replace-song-lines.use-case.ts                  # [CREAR] dividir la letra en líneas y guardarlas (Command, SRP)
│   │   │   │       ├── stream-song-audio.use-case.ts                   # [VER DETALLE] servir el audio con peticiones parciales (Range 206) (Command, SRP)
│   │   │   │       ├── sync-song-lines.use-case.ts                     # [EDITAR] guardar los tiempos de inicio y fin de cada línea (Command, SRP)
│   │   │   │       ├── update-collection.use-case.ts                   # [EDITAR] editar la colección y sus canciones (Command, SRP)
│   │   │   │       ├── update-song.use-case.ts                         # el autor o el ADMIN edita título, artista, nivel, licencia y la glosa del título | título nuevo sin glosa → se borra la …
│   │   │   │       ├── upload-song-audio.use-case.ts                   # [CREAR] subir el audio de la canción (Command, SRP)
│   │   │   │       └── withdraw-song.use-case.ts                       # [ELIMINAR] retirar la canción y su audio (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── song-collection.entity.ts                       # Tabla TypeORM / entidad de dominio (song_collections)
│   │   │   │   │   ├── song-line.entity.ts                             # Tabla TypeORM / entidad de dominio (song_lines)
│   │   │   │   │   └── song.entity.ts                                  # Tabla TypeORM / entidad de dominio (songs)
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── lyrics-draft.interface.ts                       # letra ORIGINAL de una canción didáctica generada por IA (idioma, nivel CEFR y tema) sin que el caso de uso conozca Ollam…
│   │   │   │   │   └── web-page-fetcher.interface.ts                   # descarga una página pública para leer la letra de una canción sin que el caso de uso conozca node:http, DNS ni compresió…
│   │   │   │   ├── value-objects/                                      # Value Objects
│   │   │   │   │   └── license.vo.ts                                   # License (tipo, fuente y titular de los derechos)
│   │   │   │   ├── find-media-in-html.spec.ts                          # Prueba
│   │   │   │   ├── lyrics-text.ts                                      # bytes de una página → texto de la letra (un verso por línea, estrofas separadas por una línea vacía)
│   │   │   │   ├── media-links.ts                                      # ¿qué es este enlace? — archivo de audio/vídeo directo, página de LETRAS o página de STREAMING (YouTube, Spotify…)
│   │   │   │   ├── song-readiness.ts                                   # qué le falta a una canción para enviarse a revisión o publicarse — una SSOT para el caso de uso (rechaza con 400) y para…
│   │   │   │   ├── youtube-lyrics.spec.ts                              # tiempos de cada verso desde los subtítulos del vídeo
│   │   │   │   └── youtube-lyrics.ts                                   # letra de un vídeo de YouTube SIN descargar su audio → 1) subtítulos del vídeo (los del autor o los automáticos) · 2) la …
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/                                                 # Clientes hacia FastAPI
│   │   │   │   │   ├── alignment-client.adapter.ts                     # AlignmentClient: HTTP hacia FastAPI /alignment/align; lo usa SyncSongLinesUseCase (Alignment no tenía consumidor)
│   │   │   │   │   └── lyrics-draft-client.adapter.ts                  # implementa LyricsDraftPort con el OllamaClient compartido (salida JSON restringida) y valida la forma antes de devolverl…
│   │   │   │   └── web/
│   │   │   │       └── public-web-fetcher.adapter.ts                   # GET de una página pública «como un navegador» para importar la letra de una canción
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── song-collections.controller.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── song-lines.controller.ts                            # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── song-practices.controller.ts                        # [CREAR, LISTAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── songs.controller.ts                                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── music.module.ts                                         # Composición DI del bounded context
│   │   ├── notifications/                                              # Contexto: Notificaciones en Tiempo Real
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── email-outbox-response.dto.ts                    # [LISTAR] [Sprint 11.2] DTO de salida (@ApiProperty): correo de la bandeja de salida (pendiente, enviado o fallido); esquema de respuesta en Swagger
│   │   │   │   │   └── notification-response.dto.ts                    # [LISTAR] [Sprint 11.2] DTO de salida (@ApiProperty): notificación del usuario y contador de no leídas; esquema de respuesta en Swagger
│   │   │   │   ├── listeners/                                          # Listeners de eventos de dominio
│   │   │   │   │   ├── curriculum-reviewed.listener.ts                 # Reacciona al evento de dominio (curriculum reviewed)
│   │   │   │   │   └── notification-created.listener.ts                # Reacciona al evento de dominio (notification created)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── broadcast-event.use-case.ts                     # [CREAR] UC: emitir payload a canal de usuario
│   │   │   │       ├── enqueue-email.use-case.ts                       # [CREAR] enqueue email (Command, SRP)
│   │   │   │       ├── my-notifications.use-case.ts                    # [LISTAR] my notifications (Command, SRP)
│   │   │   │       ├── publish-notification.use-case.ts                # [CREAR] publish notification (Command, SRP)
│   │   │   │       └── retry-email.use-case.ts                         # [EDITAR] retry email (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── email-outbox.entity.ts                          # Tabla TypeORM / entidad de dominio (email_outbox)
│   │   │   │   │   └── notification.entity.ts                          # Tabla TypeORM / entidad de dominio (notification)
│   │   │   │   └── interfaces/                                         # Ports (DIP)
│   │   │   │       └── notification.interface.ts                       # Port: emitir evento a canal de usuario
│   │   │   ├── infrastructure/
│   │   │   │   ├── gateways/                                           # Gateways WebSocket
│   │   │   │   │   └── notifications.gateway.ts                        # Gateway WebSocket (Adapter; Socket.IO reservado, las notificaciones usan SSE)
│   │   │   │   ├── queue/                                              # Colas Bull (procesadores)
│   │   │   │   │   └── email.processor.ts                              # Processor · worker Bull que envía por SMTP (nodemailer)
│   │   │   │   └── stream/                                             # Streaming (SSE)
│   │   │   │       └── notification-stream.service.ts                  # Service · Subject RxJS por usuario con Last-Event-ID
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── email-outbox.controller.ts                          # [LISTAR, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── notifications-stream.controller.ts                  # [LISTAR, EDITAR] Endpoint SSE autenticado (@Sse)
│   │   │   │   ├── notifications.controller.ts                         # [LISTAR, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── sse.controller.ts                                   # [LISTAR, EDITAR] GET /events: SSE endpoint por usuario autenticado
│   │   │   └── notifications.module.ts                                 # Composición DI del bounded context
│   │   ├── payments/                                                   # Contexto del módulo «Payments (Pagos)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── create-order.dto.ts                             # [CREAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── order-response.dto.ts                           # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): orden con ítems, total y estado; esquema de respuesta en Swagger
│   │   │   │   │   ├── payment-response.dto.ts                         # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): pago y estado de conciliación; esquema de respuesta en Swagger
│   │   │   │   │   └── refund-response.dto.ts                          # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): reembolso total o parcial; esquema de respuesta en Swagger
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── cancel-order.use-case.ts                        # [EDITAR] cancelar orden pendiente (Command, SRP)
│   │   │   │       ├── create-checkout-session.use-case.ts             # [CREAR] crear sesión de pago con clave de idempotencia (Command, SRP)
│   │   │   │       ├── create-order.use-case.ts                        # [CREAR] crear orden con total calculado en el servidor (Command, SRP)
│   │   │   │       ├── fulfill-order.use-case.ts                       # [EDITAR] orden cobrada → pagada + acceso a los cursos + aviso (compartido con Web3) (Command, SRP)
│   │   │   │       ├── get-payment-status.use-case.ts                  # [VER DETALLE] consultar estado del pago (Command, SRP)
│   │   │   │       ├── handle-gateway-webhook.use-case.ts              # [EDITAR] conciliar webhook firmado de la pasarela (Command, SRP)
│   │   │   │       ├── get-invoice.use-case.ts                        # [CREAR] factura PDF de una orden pagada o reembolsada (GET /payments/orders/:id/invoice) · Sprint 2.6
│   │   │   │       ├── list-my-orders.use-case.ts                      # [LISTAR] listar órdenes del usuario (Command, SRP)
│   │   │   │       ├── list-refunds.use-case.ts                        # [LISTAR] listar reembolsos (Command, SRP)
│   │   │   │       └── refund-payment.use-case.ts                      # [CREAR] reembolso total o parcial (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── order.entity.ts                                 # Tabla TypeORM / entidad de dominio (order)
│   │   │   │   │   ├── payment.entity.ts                               # Tabla TypeORM / entidad de dominio (payment)
│   │   │   │   │   └── refund.entity.ts                                # Tabla TypeORM / entidad de dominio (refund)
│   │   │   │   ├── interfaces/
│   │   │   │   │   └── payment-gateway.interface.ts                    # Interfaz de dominio (PaymentGatewayPort)
│   │   │   │   └── value-objects/                                      # Value Objects
│   │   │   │       └── money.vo.ts                                     # Money (monto + moneda)
│   │   │   ├── infrastructure/
│   │   │   │   ├── gateways/                                           # Gateways WebSocket
│   │   │   │   │   ├── mercadopago-gateway.adapter.ts                  # PaymentGatewayPort con Checkout Pro de Mercado Pago Colombia (credenciales de PRUEBA gratuitas, sin dinero real)
│   │   │   │   │   └── stripe-gateway.adapter.ts                       # StripeGatewayAdapter (SDK stripe, modo prueba)
│   │   │   │   └── invoices/                                           # Facturas en PDF
│   │   │   │       └── invoice-pdf.ts                                  # invoicePdf (pdfmake): número AULA-F-año-id, líneas y total; marca «REEMBOLSADA» · Sprint 2.6
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── orders.controller.ts                                # [CREAR, LISTAR, VER DETALLE, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── payments.controller.ts                              # [CREAR, LISTAR, VER DETALLE, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── refunds.controller.ts                               # [CREAR, LISTAR, VER DETALLE] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── payments.module.ts                                      # Composición DI del bounded context
│   │   ├── polyglot/                                                   # Contexto del módulo «Polyglot (Poliglota)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── polyglot-response.dto.ts                        # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): tabla comparativa del tema en los idiomas y el orden pedidos; esquema de respuesta en Swagger
│   │   │   │   │   └── polyglot.dto.ts                                 # Contrato de entrada/salida (class-validator) de temas, conceptos, términos, vistas y borrador
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── add-concept.use-case.ts                         # [CREAR] agregar un concepto (palabra o frase) con su emoji o imagen (Command, SRP)
│   │   │   │       ├── delete-view.use-case.ts                         # [ELIMINAR] borrar una comparación guardada (Command, SRP)
│   │   │   │       ├── enrich-terms.use-case.ts                        # [EDITAR] obtener el IPA de cada término (FastAPI) (Command, SRP)
│   │   │   │       ├── generate-topic-draft.use-case.ts                # [CREAR] pedir el borrador del tema en los siete idiomas a Ollama (OllamaClient) y el IPA a FastAPI LanguageTools (Command, SRP)
│   │   │   │       ├── get-comparison-table.use-case.ts                # [LISTAR] tabla de un tema para los idiomas elegidos y en el orden pedido (Command, SRP)
│   │   │   │       ├── list-my-views.use-case.ts                       # [LISTAR] listar comparaciones guardadas (Command, SRP)
│   │   │   │       ├── remove-concept.use-case.ts                      # [ELIMINAR] quitar un concepto (Command, SRP)
│   │   │   │       ├── remove-term.use-case.ts                         # [ELIMINAR] quitar un término (Command, SRP)
│   │   │   │       ├── review-term.use-case.ts                         # [EDITAR] marcar un término como revisado (Command, SRP)
│   │   │   │       ├── save-view.use-case.ts                           # [CREAR] guardar una comparación: tema, idiomas y orden (Command, SRP)
│   │   │   │       ├── update-concept.use-case.ts                      # [EDITAR] editar un concepto (Command, SRP)
│   │   │   │       ├── update-view.use-case.ts                         # [EDITAR] cambiar idiomas u orden (Command, SRP)
│   │   │   │       └── upsert-terms.use-case.ts                        # [CREAR] guardar los términos de un concepto en varios idiomas (Command, SRP)
│   │   │   ├── domain/                                                 # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── polyglot-concept.entity.ts                      # Tabla TypeORM / entidad de dominio (polyglot_concepts)
│   │   │   │   │   ├── polyglot-term.entity.ts                         # Tabla TypeORM / entidad de dominio (polyglot_terms)
│   │   │   │   │   ├── polyglot-topic.entity.ts                        # Tabla TypeORM / entidad de dominio (polyglot_topics)
│   │   │   │   │   └── polyglot-view.entity.ts                         # Tabla TypeORM / entidad de dominio (polyglot_views)
│   │   │   │   ├── interfaces/
│   │   │   │   │   └── polyglot-draft.interface.ts                     # Interfaz de dominio (PolyglotDraftPort)
│   │   │   │   └── language-order.ts                                   # orden de columnas: el pedido por el usuario o, por defecto, inglés, alemán, francés, portugués, ruso, chino y español al final
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   └── polyglot-draft-client.adapter.ts                # PolyglotDraftClient (borrador con OllamaClient del módulo AI + IPA con FastAPI /language-tools/ipa)
│   │   │   │   └── seeds/                                              # Datos semilla
│   │   │   │       └── polyglot-topics.seed.ts                         # familia, animales, comida, viajes y cultura
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── polyglot-concepts.controller.ts                     # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── polyglot-terms.controller.ts                        # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── polyglot-topics.controller.ts                       # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── polyglot-views.controller.ts                        # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── polyglot.module.ts                                      # Composición DI del bounded context
│   │   ├── practice/                                                   # Contexto del módulo «Practice (Práctica interactiva)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── practice-activity-response.dto.ts               # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): actividad sin las respuestas correctas; esquema de respuesta en Swagger
│   │   │   │   │   ├── practice-attempt-response.dto.ts                # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): intento con errores marcados, correcciones y consejos; esquema de respuesta en Swagger
│   │   │   │   │   └── practice-item-response.dto.ts                   # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): ítem por tipo de ejercicio; esquema de respuesta en Swagger
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── add-item.use-case.ts                            # [CREAR] agregar ítem con tipo, habilidad, respuestas aceptadas, explicación y consejo (Command, SRP)
│   │   │   │       ├── archive-activity.use-case.ts                    # [ELIMINAR] archivar actividad (Command, SRP)
│   │   │   │       ├── clear-my-attempts.use-case.ts                   # [ELIMINAR] borrar el historial propio de intentos (Command, SRP)
│   │   │   │       ├── create-activity.use-case.ts                     # [CREAR] crear actividad manual o a partir de un borrador de IA (Command, SRP)
│   │   │   │       ├── generate-activity-draft.use-case.ts             # [CREAR] pedir un borrador a Ollama mediante OllamaClient del módulo AI (Command, SRP)
│   │   │   │       ├── get-activity.use-case.ts                        # [VER DETALLE] obtener la actividad sin las respuestas correctas (Command, SRP)
│   │   │   │       ├── get-attempt.use-case.ts                         # [VER DETALLE] intento con su retroalimentación (Command, SRP)
│   │   │   │       ├── list-activities.use-case.ts                     # [LISTAR] listar actividades por idioma, nivel y habilidad (Command, SRP)
│   │   │   │       ├── list-items.use-case.ts                          # [LISTAR] listar los ítems de una actividad (Command, SRP)
│   │   │   │       ├── list-my-attempts.use-case.ts                    # [LISTAR] listar intentos propios (Command, SRP)
│   │   │   │       ├── remove-item.use-case.ts                         # [ELIMINAR] quitar ítem (Command, SRP)
│   │   │   │       ├── submit-attempt.use-case.ts                      # [CREAR] evaluar la respuesta, clasificar errores y devolver correcciones (Command, SRP)
│   │   │   │       ├── update-activity.use-case.ts                     # [EDITAR] editar y publicar actividad (Command, SRP)
│   │   │   │       └── update-item.use-case.ts                         # [EDITAR] editar ítem (Command, SRP)
│   │   │   ├── domain/                                                 # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── practice-activity.entity.ts                     # Tabla TypeORM / entidad de dominio (practice_activities)
│   │   │   │   │   ├── practice-attempt.entity.ts                      # Tabla TypeORM / entidad de dominio (practice_attempts)
│   │   │   │   │   └── practice-item.entity.ts                         # Tabla TypeORM / entidad de dominio (practice_items)
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   └── practice-attempted.event.ts                     # PracticeAttempted: progreso y logros (Observer)
│   │   │   │   ├── interfaces/
│   │   │   │   │   └── practice-evaluator.interface.ts                 # Interfaz de dominio (PracticeEvaluatorPort)
│   │   │   │   ├── item-rules.ts                                       # coherencia del ítem por tipo y vista del estudiante sin respuestas (Specification)
│   │   │   │   └── item-type.ts                                        # tipos de ítem (ordenar por arrastre, marcar errores, completar, opción múltiple, emparejar)
│   │   │   ├── infrastructure/
│   │   │   │   └── ai/
│   │   │   │       └── practice-feedback-client.adapter.ts             # PracticeFeedbackClient (HTTP hacia FastAPI /grading/practice)
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── practice-activities.controller.ts                   # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── practice-attempts.controller.ts                     # [CREAR, LISTAR, VER DETALLE, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── practice-items.controller.ts                        # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── practice.module.ts                                      # Composición DI del bounded context
│   │   ├── profile/                                                    # Contexto del módulo «Profile (inactivo)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── profile-response.dto.ts                         # [LISTAR, VER DETALLE] Contrato de entrada/salida (class-validator)
│   │   │   │   │   └── update-profile.dto.ts                           # [EDITAR] Contrato de entrada/salida (class-validator)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── get-full-profile.use-case.ts                    # [VER DETALLE] get full profile (Command, SRP)
│   │   │   │       ├── get-public-profile.use-case.ts                  # [VER DETALLE] get public profile (Command, SRP)
│   │   │   │       └── update-profile.use-case.ts                      # [EDITAR] update profile (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   └── user-profile.entity.ts                          # Tabla TypeORM / entidad de dominio (user profile)
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   └── profile-completed.event.ts                      # profile completed
│   │   │   │   └── interfaces/                                         # Ports (DIP)
│   │   │   │       └── profile.repository.interface.ts                 # [VER DETALLE, EDITAR] Interfaz de dominio (DIP) profile repository
│   │   │   ├── infrastructure/
│   │   │   │   └── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │       └── profile.repository.ts                           # [VER DETALLE, EDITAR] Implementación TypeORM del puerto
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   └── profile.controller.ts                               # [VER DETALLE, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── profile.module.ts                                       # Composición DI del bounded context
│   │   ├── quiz/                                                       # Contexto: Gestión de Quizzes y Preguntas
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── create-quiz.dto.ts                              # [CREAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── generate-ai-questions.dto.ts                    # [CREAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── quiz-response.dto.ts                            # [LISTAR, VER DETALLE] Contrato de entrada/salida (class-validator)
│   │   │   │   │   ├── submit-answer.dto.ts                            # [EDITAR] Contrato de entrada/salida (class-validator)
│   │   │   │   │   └── update-quiz.dto.ts                              # [EDITAR] Contrato de entrada/salida (class-validator)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── create-quiz.use-case.ts                         # [CREAR] UC: crear quiz personalizado + emitir evento
│   │   │   │       ├── end-session.use-case.ts                         # [EDITAR] UC: cerrar sesión + emitir QuizCompleted
│   │   │   │       ├── exams.service.ts                                # examen final de cada curso y examen de nivel por idioma — se GENERAN solos con la IA la primera vez que hacen falta (cur…
│   │   │   │       ├── generate-ai-questions.use-case.ts               # [CREAR] generate ai questions (Command, SRP)
│   │   │   │       ├── get-quiz.use-case.ts                            # [VER DETALLE] UC: obtener quiz por ID con preguntas
│   │   │   │       ├── list-my-history.use-case.ts                     # [LISTAR] list my history (Command, SRP)
│   │   │   │       ├── list-quizzes.use-case.ts                        # [LISTAR] UC: listar con filtros paginados
│   │   │   │       ├── start-session.use-case.ts                       # [CREAR] UC: crear QuizSession + timestamp inicio
│   │   │   │       ├── submit-answer.use-case.ts                       # [EDITAR] UC: registrar respuesta + avanzar
│   │   │   │       └── syllabus-source.spec.ts                         # Prueba
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── question.entity.ts                              # Entidad: texto, opciones[], respuesta correcta
│   │   │   │   │   ├── quiz-session.entity.ts                          # Entidad: sesión de juego activa
│   │   │   │   │   └── quiz.entity.ts                                  # Entidad: título, categoría, dificultad, owner
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   ├── exam-passed.event.ts                            # examen final o de nivel aprobado → Certificates emite el certificado solo
│   │   │   │   │   ├── quiz-completed.event.ts                         # Trigger → score + notificaciones + IA
│   │   │   │   │   ├── quiz-created.event.ts                           # quiz created
│   │   │   │   │   └── quiz-started.event.ts                           # quiz started
│   │   │   │   ├── interfaces/                                         # Ports (DIP)
│   │   │   │   │   ├── ai-question-provider.interface.ts               # Interfaz de dominio (DIP) ai question provider
│   │   │   │   │   └── quiz.repository.interface.ts                    # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Interfaz de dominio (DIP) quiz repository
│   │   │   │   ├── value-objects/                                      # Value Objects
│   │   │   │   │   ├── ai-provider.vo.ts                               # ai provider
│   │   │   │   │   ├── category.vo.ts                                  # VO: categoría (competencia lingüística) validada
│   │   │   │   │   ├── difficulty.vo.ts                                # VO: 'easy' | 'medium' | 'hard'
│   │   │   │   │   └── language.vo.ts                                  # Idioma del examen · ⚠ DUPLICADO de shared/domain/language.vo.ts: reutilizar el compartido (DRY)
│   │   │   │   ├── exam-rules.ts                                       # examen final de curso y examen de nivel — intentos, esperas, tiempo total y preguntas por intento
│   │   │   │   ├── final-exam-gate.ts                                  # alumno con el curso comprado y al 100 %
│   │   │   │   └── spanish-text.ts                                     # enunciado u opciones escritos en español
│   │   │   ├── infrastructure/
│   │   │   │   ├── clients/                                            # Clientes externos (Adapter)
│   │   │   │   │   ├── analytics.client.ts                             # AnalyticsClient: HTTP hacia FastAPI GET /analytics/difficulty y /analytics/anomalies (dificultad real de las preguntas; Analytics no tenía consumidor)
│   │   │   │   │   ├── aya.provider.ts                                 # Proveedor Aya Expanse (OLLAMA_AYA_MODEL)
│   │   │   │   │   ├── base-ollama-ai.provider.ts                      # Template Method: prompt, parser y validación de preguntas; el HTTP lo pone OllamaClient (módulo AI)
│   │   │   │   │   ├── mistral.provider.ts                             # Proveedor Mistral Nemo (OLLAMA_MISTRAL_MODEL)
│   │   │   │   │   └── qwen.provider.ts                                # Proveedor Qwen (OLLAMA_QWEN_MODEL)
│   │   │   │   ├── factories/
│   │   │   │   │   └── ai-provider.factory.ts                          # Selección de proveedor (Aya, Qwen o Mistral) con respaldo opcional (AI_FALLBACK_ENABLED)
│   │   │   │   └── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │       └── quiz.repository.ts                              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Impl TypeORM: relaciones + eager loading
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   └── quiz.controller.ts                                  # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Rutas mixtas: públicas (GET /quiz) + protegidas (POST)
│   │   │   └── quiz.module.ts                                          # Composición DI del bounded context
│   │   ├── reading/
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   │   └── reading.dto.ts                                  # contratos de entrada validados en la frontera (borrador IA, crear, editar, frase, progreso, exportar)
│   │   │   │   └── use-cases/
│   │   │   │       ├── create-reading-text.use-case.ts                 # guarda un texto como BORRADOR — divide en frases y programa traducción e IPA en segundo plano (2026-10-27; antes por lot…
│   │   │   │       ├── draft-reading.use-case.ts                       # BORRADOR de un texto (IA por género, nivel, tema y longitud; opcionalmente basado en material importado) — no guarda nad…
│   │   │   │       ├── enrich-reading-text.use-case.ts                 # «Completar IPA y traducción» — solo las frases a las que les falta (lotes que fallaron al crear); `force` recalcula toda…
│   │   │   │       ├── export-reading-text.use-case.ts                 # «Descargar» — TXT (UTF-8) o PDF (pdfmake vía renderPdf compartido) con original + traducción + IPA a elección
│   │   │   │       ├── get-reading-text.use-case.ts                    # texto con sus frases (traducción e IPA), si es editable y el marcador del usuario — UNA petición para el lector
│   │   │   │       ├── list-reading-texts.use-case.ts                  # lista por idioma, nivel y género — publicados para todos; «mine» = Gestión (el docente ve los suyos en cualquier estado,…
│   │   │   │       ├── reading-access.ts                               # carga un texto según el rol — el estudiante solo ve los publicados; el docente edita los suyos y el ADMIN todos
│   │   │   │       ├── reading-content.writer.ts                       # escribe el CONTENIDO de un texto — párrafos → frases → filas — en una transacción
│   │   │   │       ├── reading-progress.use-case.ts                    # guarda el «marcador de lectura» (frase y palabra) para retomar donde se quedó
│   │   │   │       ├── sentence-enricher.ts                            # traducción al español + IPA de muchas frases en LOTES hacia LanguageTools (FastAPI /language-tools/lines)
│   │   │   │       ├── update-reading-text.use-case.ts                 # edita metadatos, publica/despublica y, si llegan párrafos, re-divide el texto (conserva traducción/IPA de las frases sin…
│   │   │   │       ├── update-sentence.use-case.ts                     # el docente corrige una frase, su traducción o su IPA; si cambia el texto y no envía IPA/traducción se recalculan
│   │   │   │       └── withdraw-reading-text.use-case.ts               # retira la lectura (borrado lógico: deja de listarse y de abrirse; las frases y marcadores se conservan para auditoría)
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── reading-progress.entity.ts                      # «marcador de lectura» — dónde se quedó cada estudiante en cada texto (frase y palabra)
│   │   │   │   │   ├── reading-sentence.entity.ts                      # una frase del texto con su párrafo, orden, traducción al español e IPA (UK por defecto y US en inglés)
│   │   │   │   │   └── reading-text.entity.ts                          # texto de lectura de un género por idioma y nivel MCER, creado con IA, a mano o importado; sus frases (con traducción e I…
│   │   │   │   ├── interfaces/
│   │   │   │   │   └── reading-draft.interface.ts                      # borrador de un texto de lectura (título, resumen y párrafos) sin que el caso de uso conozca Ollama
│   │   │   │   ├── reading-export.ts                                   # forma de la descarga del estudiante — párrafos con cada frase y, a elección, su traducción y su IPA
│   │   │   │   ├── reading-genre.ts                                    # géneros de los textos de lectura (cuento, fábula, animales, poema, noticia, diálogo, biografía, leyenda)
│   │   │   │   └── sentence-splitter.ts                                # texto → párrafos → frases (determinístico, sin LLM)
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   └── reading-draft-client.adapter.ts                 # implementa ReadingDraftPort con el OllamaClient compartido (JSON restringido) y NORMALIZA la forma del JSON antes de dev…
│   │   │   │   └── export/
│   │   │   │       └── reading-pdf.ts                                  # definición declarativa del PDF (pdfmake) — título, cabecera, resumen y párrafos con traducción e IPA opcionales
│   │   │   ├── presentation/
│   │   │   │   └── reading-texts.controller.ts                         # textos de lectura — borrador con IA, crear, editar frases, completar IPA/traducción, publicar y retirar (TEACHER/ADMIN);…
│   │   │   └── reading.module.ts                                       # textos de lectura por género, idioma y nivel (IA, a mano o importados) con frases traducidas, IPA, marcador del estudian…
│   │   ├── reports/                                                    # Contexto del módulo «Reports (Exportación)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   └── report-export-response.dto.ts                   # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): exportación PDF, Excel o Word y su estado; esquema de respuesta en Swagger
│   │   │   │   ├── queries/
│   │   │   │   │   └── report-data.query.ts                            # reúne los MISMOS agregados que /admin/reports desde los puertos de Users, Score y Quiz
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── download-report-export.use-case.ts              # [VER DETALLE] descargar archivo generado (Command, SRP)
│   │   │   │       └── request-report-export.use-case.ts               # [CREAR] solicitar exportación asíncrona (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   └── report-export.entity.ts                         # Tabla TypeORM / entidad de dominio (report_export)
│   │   │   │   └── report-data.ts                                      # datos agregados (lo mismo que muestra /admin/reports) + puerto de los renderizadores
│   │   │   ├── infrastructure/
│   │   │   │   ├── queue/                                              # Colas Bull (procesadores)
│   │   │   │   │   └── report-export.processor.ts                      # Processor · worker Bull
│   │   │   │   └── renderers/                                          # Generadores de archivo por formato (Strategy)
│   │   │   │       ├── report-docx.renderer.ts                         # ReportDocxRenderer (docx) · Word · 2026-10-19
│   │   │   │       ├── report-pdf.renderer.ts                          # ReportPdfRenderer (pdfmake)
│   │   │   │       └── report-xlsx.renderer.ts                         # ReportXlsxRenderer (exceljs)
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   └── report-exports.controller.ts                        # [CREAR, LISTAR, VER DETALLE, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── reports.module.ts                                       # Composición DI del bounded context
│   │   ├── scheduler/                                                  # Contexto del módulo «Scheduler (Tareas programadas)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   └── scheduled-job-response.dto.ts                   # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): trabajo programado y estado de su cola; esquema de respuesta en Swagger
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── list-jobs.use-case.ts                           # [LISTAR] estado de las colas (Command, SRP)
│   │   │   │       ├── purge-expired-sessions.use-case.ts              # [ELIMINAR] purgar sesiones y tokens vencidos (Command, SRP)
│   │   │   │       └── run-job.use-case.ts                             # [EDITAR] ejecutar trabajo manualmente (Command, SRP)
│   │   │   ├── infrastructure/
│   │   │   │   └── queue/                                              # Colas Bull (procesadores)
│   │   │   │       └── maintenance.processor.ts                        # Processor · trabajos repetibles de Bull (cron)
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   └── scheduled-jobs.controller.ts                        # [LISTAR, VER DETALLE, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── scheduler.module.ts                                     # Composición DI del bounded context
│   │   ├── score/                                                      # Contexto: Puntuaciones y Logros
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── leaderboard-response.dto.ts                     # [LISTAR, VER DETALLE] Contrato de entrada/salida (class-validator)
│   │   │   │   │   └── submit-score.dto.ts                             # [CREAR] Contrato de entrada/salida (class-validator)
│   │   │   │   ├── listeners/                                          # Listeners de eventos de dominio
│   │   │   │   │   ├── dialogue-session-completed.listener.ts          # al terminar una conversación con el avatar se revisan los logros con la cobertura del vocabulario del tema
│   │   │   │   │   ├── game-completed.listener.ts                      # al terminar una partida se revisan los logros con su precisión (el puntaje de la partida vive en GameSession)
│   │   │   │   │   ├── practice-attempted.listener.ts                  # cada intento de práctica revisa los logros con su precisión (puntos por evento)
│   │   │   │   │   └── quiz-completed.listener.ts                      # Reacciona al evento de dominio (quiz completed)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── calculate-score.use-case.ts                     # UC: puntos base + bonus velocidad/dificultad
│   │   │   │       ├── check-achievements.use-case.ts                  # UC: evaluar condiciones de logros
│   │   │   │       ├── get-leaderboard.use-case.ts                     # [LISTAR] UC: top N global/categoría/período + caché
│   │   │   │       ├── get-user-history.use-case.ts                    # [VER DETALLE] UC: historial paginado por usuario
│   │   │   │       └── save-score.use-case.ts                          # [CREAR] UC: persistir Score + emitir ScoreUpdated
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── achievement.entity.ts                           # Entidad: tipo, desbloqueado, userId
│   │   │   │   │   └── score.entity.ts                                 # Entidad: puntos, tiempo, accuracy, userId, quizId
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   ├── achievement-unlocked.event.ts                   # achievement unlocked
│   │   │   │   │   └── score-updated.event.ts                          # score updated
│   │   │   │   ├── interfaces/                                         # Ports (DIP)
│   │   │   │   │   ├── achievement.repository.interface.ts             # Interfaz de dominio (DIP) achievement repository
│   │   │   │   │   └── score.repository.interface.ts                   # [LISTAR, VER DETALLE] Interfaz de dominio (DIP) score repository
│   │   │   │   └── value-objects/                                      # Value Objects
│   │   │   │       └── points.vo.ts                                    # VO: float >= 0 con fórmula bonus encapsulada
│   │   │   ├── infrastructure/
│   │   │   │   └── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │       ├── achievement.repository.ts                       # Implementación TypeORM del puerto
│   │   │   │       └── score.repository.ts                             # [LISTAR, VER DETALLE] Implementación TypeORM del puerto
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   └── score.controller.ts                                 # [LISTAR, VER DETALLE] POST /score/submit + GET /score/leaderboard
│   │   │   └── score.module.ts                                         # Composición DI del bounded context
│   │   ├── users/                                                      # Contexto: Gestión de Usuarios
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── optional-phone.decorator.ts                     # decorador compuesto del campo `phone` para TODOS los DTOs (RegisterDto, UpdateProfileDto, AdminCreate/UpdateUserDto)
│   │   │   │   │   ├── optional-social-url.decorator.ts                # decorador compuesto de cada red social del perfil (linkedinUrl, twitterUrl, spotifyUrl, youtubeUrl)
│   │   │   │   │   ├── update-profile.dto.ts                           # [EDITAR] Contrato de entrada (class-validator) · ⚠ DUPLICADO con el módulo Profile (mismo caso de uso): consolidar en Profile y borrar de Users
│   │   │   │   │   └── user-response.dto.ts                            # [LISTAR, VER DETALLE] DTO salida: sin password, sin tokens · ⚠ archivo vacío (marcador)
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── change-password.use-case.ts                     # el usuario autenticado cambia su contraseña verificando la actual
│   │   │   │       ├── create-user.use-case.ts                         # [CREAR] UC: único alta de User (email único + hash bcrypt + persistencia); lo usan POST /users, el registro y OAuth
│   │   │   │       ├── delete-account.use-case.ts                      # [ELIMINAR] UC: baja GDPR + anonimización
│   │   │   │       ├── get-profile.use-case.ts                         # [VER DETALLE] Perfil propio · ⚠ DUPLICADO con el módulo Profile (mismo caso de uso): consolidar en Profile y borrar de Users
│   │   │   │       ├── get-user-history.use-case.ts                    # [LISTAR] Historial de exámenes de un estudiante (docente)
│   │   │   │       └── update-profile.use-case.ts                      # [EDITAR] Editar perfil propio · ⚠ DUPLICADO con el módulo Profile (mismo caso de uso): consolidar en Profile y borrar de Users
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   └── user.entity.ts                                  # Entidad: id, email, name, avatar, roles, createdAt
│   │   │   │   ├── events/
│   │   │   │   │   └── profile-updated.event.ts                        # Perfil actualizado · ⚠ DUPLICADO con el módulo Profile (mismo caso de uso): consolidar en Profile y borrar de Users
│   │   │   │   ├── interfaces/                                         # Ports (DIP)
│   │   │   │   │   └── user.repository.interface.ts                    # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Port (DIP)
│   │   │   │   └── value-objects/                                      # Value Objects
│   │   │   │       ├── email.vo.ts                                     # VO: email validado con regex + lowercase
│   │   │   │       ├── phone.vo.ts                                     # regla ÚNICA del teléfono del usuario (registro, Mi perfil y Gestión → usuarios)
│   │   │   │       ├── role.vo.ts                                      # VO: enum USER | TEACHER | ADMIN
│   │   │   │       ├── social-links.vo.spec.ts                         # la regla única de redes sociales (https + dominio de la red)
│   │   │   │       └── social-links.vo.ts                              # regla ÚNICA de los enlaces públicos del perfil (LinkedIn, X/Twitter, Spotify, YouTube)
│   │   │   ├── infrastructure/
│   │   │   │   └── repositories/                                       # Repositorios (implementan los ports)
│   │   │   │       └── user.repository.ts                              # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Impl TypeORM con soft-delete
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── profile.controller.ts                               # [LISTAR, VER DETALLE, EDITAR, ELIMINAR] /profile/me: GET, GET history, PATCH, DELETE · ⚠ DUPLICADO con el módulo Profile (mismo caso de uso): consolidar en Profile y borrar de Users
│   │   │   │   └── users.controller.ts                                 # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Rutas ADMIN/TEACHER /users; POST delega en CreateUserUseCase
│   │   │   └── users.module.ts                                         # Composición DI del bounded context
│   │   ├── vocabulary/                                                 # Contexto del módulo «Vocabulary (Vocabulario e IPA)»
│   │   │   ├── application/
│   │   │   │   ├── dtos/                                               # DTOs (class-validator)
│   │   │   │   │   ├── vocabulary-entry-response.dto.ts                # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): entrada del banco con IPA UK/US y estado automático o revisado; esquema de respuesta en Swagger
│   │   │   │   │   ├── vocabulary-entry.dto.ts                         # Contrato de entrada/salida (class-validator)
│   │   │   │   │   └── word-lookup-response.dto.ts                     # [VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): consulta de palabra: traducción, IPA, sonido y ejemplos breves; esquema de respuesta en Swagger
│   │   │   │   ├── listeners/                                          # Listeners de eventos de dominio
│   │   │   │   │   ├── curriculum-grammar-repair.listener.ts           # las fichas de vocabulario del currículo guardadas SIN artículo/género/plural/clasificador
│   │   │   │   │   └── resource-created.listener.ts                    # reacciona al evento ResourceCreated y enriquece el recurso con traducción e IPA
│   │   │   │   └── use-cases/                                          # Casos de uso
│   │   │   │       ├── complete-grammar.use-case.ts                    # artículo/género/plural/clasificador de cada sustantivo vía FastAPI
│   │   │   │       ├── create-vocabulary-entry.use-case.ts             # [CREAR] crear entrada y completar traducción e IPA UK y US (Command, SRP)
│   │   │   │       ├── delete-vocabulary-entry.use-case.ts             # [ELIMINAR] eliminar una entrada propia (Command, SRP)
│   │   │   │       ├── list-marked-words.use-case.ts                   # [LISTAR] palabras marcadas, para resaltarlas en un texto (Command, SRP)
│   │   │   │       ├── list-my-vocabulary.use-case.ts                  # [LISTAR] listar el banco de vocabulario con filtros (Command, SRP)
│   │   │   │       ├── lookup-term.use-case.ts                         # [CREAR] traducir y transcribir con caché por huella (texto, idiomas, acento) (Command, SRP)
│   │   │   │       ├── topic-title.use-case.ts                         # [CREAR] título del tema en el idioma estudiado con IPA (POST /vocabulary/lookup/topic) · 2026-10-19
│   │   │   │       ├── lookup-word.use-case.ts                         # [CREAR] consultar una palabra dentro de su frase: traducción según el contexto, IPA y hasta dos ejemplos breves (Command, SRP)
│   │   │   │       ├── mark-word-learned.use-case.ts                   # [EDITAR] marcar la palabra como aprendida (Command, SRP)
│   │   │   │       ├── mark-word-learning.use-case.ts                  # [CREAR] crear la entrada con estado «aprendiendo» y agregarla al mazo de flashcards (Command, SRP)
│   │   │   │       ├── purge-lookup-cache.use-case.ts                  # [ELIMINAR] purgar la caché de traducciones (Command, SRP)
│   │   │   │       ├── unmark-word.use-case.ts                         # [ELIMINAR] dejar de marcar la palabra (Command, SRP)
│   │   │   │       └── update-vocabulary-entry.use-case.ts             # [EDITAR] corregir traducción, IPA o ejemplo (la corrección manual prevalece) (Command, SRP)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                                           # Entidades de dominio
│   │   │   │   │   ├── language-lookup.entity.ts                       # Tabla TypeORM / entidad de dominio (language_lookups)
│   │   │   │   │   └── vocabulary-entry.entity.ts                      # Tabla TypeORM / entidad de dominio (vocabulary_entries)
│   │   │   │   ├── events/                                             # Eventos de dominio
│   │   │   │   │   └── word-marked-to-learn.event.ts                   # WordMarkedToLearn: «Aprender» del diccionario → mazo de flashcards en Games (Observer)
│   │   │   │   └── noun-grammar.ts                                     # cada sustantivo se guarda como unidad gramatical completa
│   │   │   ├── infrastructure/
│   │   │   │   └── ai/
│   │   │   │       ├── language-tools-client.adapter.ts                # LanguageToolsClient (HTTP hacia FastAPI /language-tools)
│   │   │   │       └── user-words-index.listener.ts                    # palabra marcada «aprender» (también desde el lector de libros) → índice RAG del tutor
│   │   │   ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │   │   │   ├── language-lookup.controller.ts                       # [CREAR, VER DETALLE, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── vocabulary.controller.ts                            # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   ├── word-lookup.controller.ts                           # [CREAR, VER DETALLE, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   │   └── word-status.controller.ts                           # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │   │   └── vocabulary.module.ts                                    # Composición DI del bounded context
│   │   └── web3/                                                       # Contexto del módulo «Web3 (Blockchain y criptomonedas)»
│   │       ├── application/
│   │       │   ├── dtos/                                               # DTOs (class-validator)
│   │       │   │   ├── crypto-payment-response.dto.ts                  # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): pago cripto, hash de la transacción y confirmaciones; esquema de respuesta en Swagger
│   │       │   │   └── wallet-response.dto.ts                          # [LISTAR, VER DETALLE] [Sprint 11.2] DTO de salida (@ApiProperty): billetera vinculada (dirección EIP-55); esquema de respuesta en Swagger
│   │       │   └── use-cases/                                          # Casos de uso
│   │       │       ├── anchor-certificate-hash.use-case.ts             # [CREAR] anclar el hash SHA-256 del PDF en una transacción de Sepolia (Command, SRP)
│   │       │       ├── confirm-onchain-payment.use-case.ts             # [EDITAR] verificar remitente, red, destinatario, monto y confirmaciones y pasar a PAGADO, FALLIDO o EXPIRADO (Command, SRP)
│   │       │       ├── create-crypto-payment.use-case.ts               # [CREAR] crear el pago cripto PENDIENTE con el monto en ETH de prueba según la tasa fija de demostración (Command, SRP)
│   │       │       ├── create-siwe-nonce.use-case.ts                   # [CREAR] emitir nonce SIWE de un solo uso (Command, SRP)
│   │       │       ├── get-crypto-payment.use-case.ts                  # [VER DETALLE] consultar estado y confirmaciones (Command, SRP)
│   │       │       ├── link-wallet.use-case.ts                         # [EDITAR] verificar firma EIP-4361 y vincular (Command, SRP)
│   │       │       ├── register-crypto-tx.use-case.ts                  # [EDITAR] registrar el hash de la transacción (idempotente) y encolar su verificación (Command, SRP)
│   │       │       ├── unlink-wallet.use-case.ts                       # [ELIMINAR] desvincular billetera (Command, SRP)
│   │       │       └── verify-certificate-hash.use-case.ts             # [VER DETALLE] leer la transacción de anclaje con viem y comparar el hash SHA-256 del PDF (RF-93) (Command, SRP)
│   │       ├── domain/
│   │       │   ├── entities/                                           # Entidades de dominio
│   │       │   │   ├── crypto-payment.entity.ts                        # Tabla TypeORM / entidad de dominio (crypto_payment)
│   │       │   │   └── wallet.entity.ts                                # Tabla TypeORM / entidad de dominio (wallet)
│   │       │   ├── interfaces/
│   │       │   │   └── blockchain-gateway.interface.ts                 # BlockchainGatewayPort: sendTransaction, getTransaction y getConfirmations
│   │       │   └── value-objects/                                      # Value Objects
│   │       │       └── evm-address.vo.ts                               # EvmAddress (checksum EIP-55)
│   │       ├── infrastructure/
│   │       │   ├── chain/
│   │       │   │   ├── fake-blockchain.adapter.ts                      # FakeBlockchainAdapter en memoria para pruebas, sin red
│   │       │   │   └── viem-blockchain.adapter.ts                      # ViemBlockchainAdapter (Sepolia; URL del RPC y clave de la plataforma por variables de entorno)
│   │       │   └── jobs/                                               # Trabajos en segundo plano (Bull)
│   │       │       ├── certificate-anchor.processor.ts                 # ancla el hash del certificado y guarda el hash de la transacción
│   │       │       └── crypto-payment.processor.ts                     # verifica el pago cripto en segundo plano con reintentos
│   │       ├── presentation/                                           # Capa Presentación — entrada HTTP
│   │       │   ├── crypto-payments.controller.ts                       # [CREAR, LISTAR, VER DETALLE, EDITAR] Endpoints REST, guards de rol y validación de DTOs
│   │       │   └── wallets.controller.ts                               # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints REST, guards de rol y validación de DTOs
│   │       └── web3.module.ts                                          # Composición DI del bounded context
│   ├── shared/                                                         # Cross-Cutting Concerns (AOP)
│   │   ├── application/                                                # Servicios de aplicación genéricos
│   │   │   ├── topic-crud.service.ts                                   # TopicCrudService<T>: crear, listar, editar y archivar temas sobre la entidad de cada módulo; lo usan Dialogues, Grammar y Polyglot (DRY)
│   │   │   └── unique-title.ts                                         # ningún recurso/actividad/examen/curso se repite con el MISMO título (normalizado) dentro de su ámbito (idioma + nivel + …
│   │   ├── background/
│   │   │   ├── background-tasks.module.ts                              # expone UNA cola en segundo plano a todo el backend (Lectura, Diálogos, Gramática…)
│   │   │   └── background-tasks.ts                                     # «guardar primero, enriquecer después» — ejecuta en segundo plano (mismo proceso) el trabajo lento que NO debe retener la…
│   │   ├── cache/
│   │   │   └── redis-cache.module.ts                                   # caché distribuida en Redis para cache-manager (RF-75)
│   │   ├── config/                                                     # Configuración
│   │   │   ├── database.config.ts                                      # TypeORM factory: host, port, entities, migrations
│   │   │   ├── jwt.config.ts                                           # JWT: secret, accessExpiry (15m), refreshExpiry (7d)
│   │   │   ├── oauth.config.ts                                         # Configuración OAuth: client IDs y tenants para verificación de id_token
│   │   │   ├── redis.config.ts                                         # Redis: host, port, password, db index
│   │   │   ├── payments.config.ts                                      # [Sprint 7.3] STRIPE_* (solo claves de prueba) y PAYMENTS_RETURN_URL validadas con Zod al arrancar
│   │   │   ├── storage.config.ts                                       # [Sprint 6.7] STORAGE_PROVIDER=local|s3, S3_* y MAX_UPLOAD_MB validadas con Zod al arrancar (falla rápido)
│   │   │   ├── swagger.config.ts                                       # [Sprint 11.2] buildOpenApiDocument() + setupSwagger(): fuente única del OpenAPI (main.ts, export-openapi.ts y swagger-contract.spec.ts)
│   │   │   ├── throttler.config.ts                                     # Rate limit: ttl (60s), limit (100 req)
│   │   │   └── web3.config.ts                                          # [Sprint 7.6] WEB3_RPC_URL, cuenta de la plataforma, confirmaciones y tasa de demostración validadas con Zod (solo Sepolia)
│   │   ├── decorators/                                                 # Decoradores
│   │   │   ├── api-auth.decorator.ts                                   # [Sprint 11.2] @ApiAuth(...roles): bearer + 401/403 + roles permitidos en una sola línea
│   │   │   ├── api-error-responses.decorator.ts                        # [Sprint 11.2] @ApiStandardErrors(): documenta 400/401/403/404/409/422/429/5xx con ApiErrorDto
│   │   │   ├── api-paginated-response.decorator.ts                     # [Sprint 11.2] @ApiPaginatedResponse(Dto): listado con { data, meta } y PageMetaDto
│   │   │   ├── api-response.decorator.ts                               # Swagger shorthand: @ApiOkResponse tipado
│   │   │   ├── current-user.decorator.ts                               # @CurrentUser() extrae user del JWT payload
│   │   │   ├── public.decorator.ts                                     # @Public() skip JwtAuthGuard en rutas abiertas
│   │   │   └── roles.decorator.ts                                      # @Roles(Role.ADMIN) para RolesGuard
│   │   ├── domain/                                                     # Capa Dominio — sin dependencias externas (DIP)
│   │   │   ├── interfaces/                                             # Ports compartidos (DIP)
│   │   │   │   ├── alignment.interface.ts                              # inicio y fin de cada línea a partir del audio (FastAPI Alignment) sin que los casos de uso conozcan HTTP — lo usan Music…
│   │   │   │   └── language-tools.interface.ts                         # LanguageToolsPort: traducción, IPA y voz vía FastAPI /language-tools; lo usan Vocabulary, Polyglot y Grammar (DRY)
│   │   │   ├── article-ipa.ts                                          # antepone el IPA del artículo cuando la palabra se muestra CON artículo
│   │   │   ├── cefr-level.vo.ts                                        # Value Object CefrLevel: los 6 niveles del Marco Común Europeo de Referencia (MCER/CEFR)
│   │   │   ├── language-skill.vo.ts                                    # Value Object LanguageSkill: competencias comunicativas del MCER usadas por curriculum (y alineadas con las Category vigentes de quiz)
│   │   │   ├── language.vo.ts                                          # Value Object Language: idiomas objetivo de la plataforma (ISO 639-1)
│   │   │   ├── llm-json.ts                                             # lectura TOLERANTE de la salida JSON de los modelos locales (Ollama) — compartida por los borradores de Práctica y Diálog…
│   │   │   ├── noun-rule.prompt.ts                                     # instrucción para los generadores con IA (juegos, políglota…) → cada sustantivo con su artículo/clasificador
│   │   │   ├── target-language.ts                                      # los modelos pequeños (qwen2.5:3b) responden en ESPAÑOL cuando el tema llega en español aunque el prompt pida inglés
│   │   │   └── title-key.ts                                            # clave normalizada de un título para detectar duplicados («El verbo être!» ≡ «el verbo etre»)
│   │   ├── filters/                                                    # Filtros de excepciones
│   │   │   └── http-exception.filter.ts                                # Manejo centralizado: formato unificado de errores
│   │   ├── guards/                                                     # Guards
│   │   │   ├── jwt-auth.guard.ts                                       # Guard: valida JWT en cada request protegida
│   │   │   ├── roles.guard.ts                                          # Guard: RBAC verifica @Roles() metadata
│   │   │   └── throttler.guard.ts                                      # Guard: rate limiting por IP y por usuario
│   │   ├── interceptors/                                               # Interceptores (AOP)
│   │   │   ├── logging.interceptor.ts                                  # AOP: log entrada/salida + duración ms
│   │   │   ├── timeout.interceptor.ts                                  # AOP: timeout 30s por request + 503
│   │   │   └── transform.interceptor.ts                                # AOP: envelope { data, meta, timestamp }
│   │   ├── noun-grammar/
│   │   │   └── noun-grammar.service.ts                                 # gramática de VARIOS términos en una sola llamada a FastAPI (/noun-grammar/batch)
│   │   ├── pdf/
│   │   │   └── render-pdf.ts                                           # ÚNICO punto que genera PDFs (reportes, certificados y facturas) con pdfmake
│   │   ├── pipes/                                                      # Pipes
│   │   │   └── validation.pipe.ts                                      # Chain: class-validator + class-transformer global
│   │   ├── http/                                                       # Respuestas HTTP compartidas
│   │   │   ├── audio-mime.ts                                           # tipo real de un audio/vídeo subido — mira los «magic bytes» y la extensión, no solo el Content-Type del navegador
│   │   │   └── ranged-response.ts                                      # sendRanged(): 200/206/416 por rangos; con URL firmada responde 302 al bucket (Sprint 6.7)
│   │   ├── storage/                                                    # [Sprint 6.7] Almacén de objetos compartido por Audio, Courses y Reports (STORAGE_PROVIDER=local|s3)
│   │   │   ├── local-object.store.ts                                   # LocalObjectStore: objetos en disco bajo UPLOADS_DIR/<prefijo>, con anti path-traversal
│   │   │   ├── mirrored-object.store.ts                                # MirroredObjectStore: nube + copia local; si el bucket falla se sirve el disco · 2026-10-19
│   │   │   ├── object-key.ts                                           # assertKey(): claves válidas (sin «..» ni ruta absoluta) para disco y S3
│   │   │   ├── object-store.ts                                         # Puerto ObjectStore (put, size, open con rango, remove, signedUrl) + fábrica createObjectStore(prefijo)
│   │   │   └── s3-object.store.ts                                      # S3ObjectStore: único adaptador S3 (AWS SDK v3) para MinIO y Cloudflare R2; subida por partes, Range, URL firmada SigV4, sin ACL
│   │   ├── swagger/                                                    # [Sprint 11.2] Esquemas compartidos de Swagger (envelope, errores y paginación)
│   │   │   ├── api-envelope.dto.ts                                     # ApiEnvelopeDto<T>: { data, meta, timestamp }, el formato que escribe TransformInterceptor
│   │   │   ├── api-error.dto.ts                                        # ApiErrorDto: formato unificado de errores que escribe HttpExceptionFilter
│   │   │   ├── pagination.dto.ts                                       # PageQueryDto y PageMetaDto: paginación reutilizada por todos los listados (DRY)
│   │   │   └── swagger-tags.ts                                         # Constantes ApiTag por módulo: sin cadenas repetidas en @ApiTags
│   │   └── utils/                                                      # Utilidades
│   │       ├── is-sse.util.ts                                          # ¿el handler es un endpoint @Sse? → los interceptores globales no deben envolverlo ni cortarlo por timeout
│   │       └── period.util.ts                                          # Util periodo: convierte un número de meses (2/3/6/12) en fecha de corte
│   ├── app.controller.spec.ts                                          # Prueba base del controlador raíz
│   ├── app.controller.ts                                               # [LISTAR] app controller
│   ├── app.module.ts                                                   # Root Module: ConfigModule, TypeORM, Redis, módulos
│   ├── app.service.ts                                                  # app service
│   └── main.ts                                                         # Swagger UI en /api/docs y OpenAPI 3 (RF-73), ValidationPipe global, CORS y Helmet
├── __tests__/                                                          # ══ PRUEBAS ══════════════════════════════
│   ├── functional/                                                     # FUNCIONALES (E2E) — Jest + Supertest
│   │   ├── auth-flow.e2e-spec.ts                                       # Register → login → refresh → logout completo
│   │   ├── full-game.e2e-spec.ts                                       # Flujo completo: login → quiz → score → leaderboard
│   │   ├── quiz-flow.e2e-spec.ts                                       # Crear quiz → iniciar → responder → finalizar → score
│   │   ├── rate-limiting.e2e-spec.ts                                   # [EDITAR] 101 req/min → 429 con Retry-After header
│   │   └── rbac.e2e-spec.ts                                            # USER rechazado en rutas ADMIN con 403 correcto
│   ├── helpers/
│   │   ├── fake-engagement.repository.ts                               # repositorio en memoria que cumple ICourseEngagementRepository → lo comparten las pruebas unitarias y de integración (DRY…
│   │   └── postgres-test-schema.ts                                     # conexión a PostgreSQL REAL en un ESQUEMA TEMPORAL (no toca las tablas de la app) para probar migraciones
│   ├── integration/                                                    # INTEGRACIÓN — Jest + Supertest + BD/Redis de test
│   │   ├── auth/
│   │   │   ├── login.integration.spec.ts                               # [CREAR] POST /auth/login → 200 + JWT pair válido
│   │   │   ├── refresh.integration.spec.ts                             # [EDITAR] POST /auth/refresh → nuevo par, viejo invalidado
│   │   │   └── register.integration.spec.ts                            # [CREAR] POST /auth/register → 201 + user en BD + token
│   │   ├── courses/
│   │   │   ├── course-engagement.integration.spec.ts                   # controladores REALES + ValidationPipe global + caso de uso REAL → contrato HTTP de ⭐ y 👍/❤️
│   │   │   ├── course-favorites-reactions.migration.integration.spec.ts  # up/down contra PostgreSQL REAL en un ESQUEMA TEMPORAL (no toca las tablas de la app) que se borra al terminar
│   │   │   ├── materials-upload.integration.spec.ts                    # Subida multipart de material y autorización
│   │   │   └── s3-file.storage.integration.spec.ts                     # [Sprint 6.7] Subir, leer con Range, borrar y URL firmada contra MinIO
│   │   ├── curriculum/
│   │   │   └── curated-article-rules.migration.integration.spec.ts     # corrección de las fichas a/an/the contra PostgreSQL real (esquema temporal) — up idempotente y down reversible
│   │   ├── notifications/
│   │   │   └── sse.integration.spec.ts                                 # SSE stream recibe ScoreUpdated dentro de 1s
│   │   ├── profile/
│   │   │   └── profile.integration.spec.ts                             # GET/PATCH del perfil con JWT
│   │   ├── quiz/
│   │   │   ├── fetch-questions.integration.spec.ts                     # GET /quiz (listado) y GET /quiz/:id (detalle) con casos de uso mockeados
│   │   │   └── session.integration.spec.ts                             # POST start → submit × N → end → QuizCompleted
│   │   └── score/
│   │       ├── leaderboard.integration.spec.ts                         # GET /score/leaderboard → ranking ordenado correctamente
│   │       └── submit.integration.spec.ts                              # [CREAR] POST /score/submit → Score en BD + evento emitido
│   ├── performance/                                                    # RENDIMIENTO — k6 + Artillery
│   │   ├── artillery/
│   │   │   ├── artillery.config.yml                                    # Config: base URL, auth headers, duración 10min
│   │   │   └── sse-load.yml                                            # SSE: 1000 conexiones concurrentes <1% pérdida eventos
│   │   └── k6/
│   │       ├── jwt-validation.k6.js                                    # Auth endpoints: p99<50ms bajo 500 req/s
│   │       └── score-submit.k6.js                                      # POST /score/submit: >200 req/s p95<300ms (BD write)
│   ├── unit/                                                           # UNITARIAS — Jest + @nestjs/testing
│   │   ├── ai/
│   │   │   └── tutor-conversations.spec.ts                             # propiedad (ajena = 404), enviar guarda los dos turnos, editar trunca y regenera, borrar mensaje recalcula el uso del idi…
│   │   ├── audio/
│   │   │   └── audio.spec.ts                                           # [VER DETALLE] clave, rangos, Cache-Aside, autorreparación y carrera
│   │   ├── books/
│   │   │   ├── book-language.spec.ts                                   # por párrafo y bajo demanda, con el párrafo anterior como contexto,
│   │   │   ├── book-text.spec.ts                                       # limpieza del encabezado y pie de Gutenberg, capítulos en varios idiomas, páginas, frases,
│   │   │   ├── books-catalog.spec.ts                                   # filtro de autores (Colombia, vida + 80), idioma, texto plano, reintentos y caché
│   │   │   ├── clauses.spec.ts                                         # renglones cortos para la IPA renglón a renglón del lector de libros
│   │   │   ├── user-words-index.spec.ts                                # marcar «aprender» → SOLO esa palabra al RAG, con token a nombre del usuario · fallo → no rompe
│   │   │   └── wikisource.spec.ts                                      # HTML de MediaWiki → texto, índice de capítulos, ids y elección de fuente (Wikisource o Gutendex)
│   │   ├── certificates/
│   │   │   └── certificate-verify-url.spec.ts                          # el QR del certificado apunta a la página PÚBLICA de verificación https://<DOMINIO>/certificados/verificar/<código>
│   │   ├── courses/
│   │   │   ├── course-content.spec.ts                                  # `content` (Markdown) sin límite de longitud y separado de la descripción
│   │   │   ├── course-materials.spec.ts                                # [CREAR] Caso de uso de materiales: orden, tipo y acceso
│   │   │   ├── course-ownership.spec.ts                                # ADMIN gestiona todos · TEACHER solo los suyos · cursos sin dueño → solo ADMIN
│   │   │   └── fake-file.storage.ts                                    # [Sprint 6.7] FakeFileStorage en memoria (sin red ni disco): subir, URL firmada y rangos en el caso de uso
│   │   ├── curriculum/
│   │   │   ├── bulk-publish.spec.ts                                    # un tema completo se publica en UNA petición, sin saltos de estado y de forma idempotente (reintentar completa lo que fal…
│   │   │   ├── certifications.spec.ts                                  # [CREAR] catálogo coherente, validaciones y aviso de originalidad
│   │   │   ├── course-outline.spec.ts                                  # [CREAR] jerarquía, reutilización y «solo huecos»
│   │   │   ├── curriculum-ai.spec.ts                                   # Borradores IA: caché, lotes y control de idioma
│   │   │   ├── curriculum-catalog.spec.ts                              # Catálogo de temas y fuentes
│   │   │   ├── curriculum-commands.spec.ts                             # Crear, editar, borrar y cambiar estado
│   │   │   ├── curriculum-domain.spec.ts                               # Reglas de dominio (slug, procedencia, estados)
│   │   │   ├── curriculum-grammar-repair.spec.ts                       # fichas del currículo sin artículo/género/plural/clasificador → se completan sin pisar lo del docente
│   │   │   ├── grammar-templates.spec.ts                               # reglas de gramática curadas (7 idiomas), borrador sin LLM y publicación bloqueada sin revisión docente
│   │   │   ├── headline.spec.ts                                        # el vocabulario chino tenía clave '' (slug latino vacío) → todos los elementos parecían repetidos
│   │   │   ├── knowledge-index-sync.spec.ts                            # el cambio de un recurso (manual, archivo o enlace) llega al índice RAG en lote, con token de servicio y fail-soft
│   │   │   ├── pronunciation-media.spec.ts                             # imagen/video de la boca en «Cómo se pronuncia» — lista blanca, clave sin datos personales,
│   │   │   ├── source-comparison.spec.ts                               # [EDITAR] sinónimos, variantes de IPA, misma fuente y bandera en la traza de IA
│   │   │   ├── vocabulary-article.spec.ts                              # artículo obligatorio en sustantivos de/fr/pt/es · opcional en inglés · «No aplica» en ruso y chino
│   │   │   └── vocabulary-with-article.spec.ts                         # el sustantivo se guarda con su artículo (der Tisch, l'école) sin inventar nada
│   │   ├── dialogues/
│   │   │   ├── resolve-license.spec.ts                                 # los datos de derechos solo se exigen al texto IMPORTADO (de terceros); lo generado con IA o escrito por el docente
│   │   │   └── translation-sanitizer.spec.ts                           # cadenas EXACTAS del reporte de «Temas de conversación» (JSON crudo y «yes» → «yes»)
│   │   ├── dtos/
│   │   │   ├── language-auto.dto.spec.ts                               # el Traductor y el Corrector aceptan 'auto' como idioma de origen; el resto sigue cerrado a los 7 idiomas
│   │   │   └── register.dto.spec.ts                                    # el teléfono es opcional y usa la regla única de `@OptionalPhone` (phone.vo.ts)
│   │   ├── games/
│   │   │   ├── fit-deck-items.spec.ts                                  # caso real «Los alimentos» en alemán → español con artículo alemán, huevo/huevos y categorías sueltas
│   │   │   ├── game-decks.spec.ts                                      # limpieza de las palabras de un juego con material propio (también filtra la salida del LLM) + ruta de borrador con el ti…
│   │   │   └── target-language.spec.ts                                 # detectar respuestas en español con idioma meta ≠ es y reintentar · agrupar frases sueltas en párrafos
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.spec.ts                                  # Permite request con JWT válido, 401 sin token
│   │   │   └── roles.guard.spec.ts                                     # 403 para USER en ruta @Roles(ADMIN)
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.spec.ts                           # Respuesta envuelta en { data, meta, timestamp }
│   │   ├── music/
│   │   │   ├── enrich-song-lines.spec.ts                               # trozos de 20 líneas, reintento y respaldo de IPA cuando FastAPI no responde
│   │   │   ├── level-estimate.spec.ts                                  # nivel MCER estimado del texto (canción al cargar la letra · lectura al crearla)
│   │   │   ├── list-songs.spec.ts                                      # «mías» en Gestión — el ADMIN ve TODAS las canciones (borradores y cola de revisión de los docentes), el docente solo las…
│   │   │   ├── lyrics-text.spec.ts                                     # extractor de letras desde HTML (sitios conocidos, genérico y último recurso) + charset
│   │   │   ├── media-links.spec.ts                                     # clasificación del enlace del audio (letras / streaming / directo) y Fail Fast de «subir audio por URL» sin petición sali…
│   │   │   ├── public-web-fetcher.spec.ts                              # anti-SSRF, descompresión, reintento con otro perfil de navegador ante un 403 y diagnóstico de anti-bots
│   │   │   └── song-readiness-and-ai.spec.ts                           # requisitos de publicación (SSOT de la UI y del 400) y limpieza del JSON de la letra generada por IA
│   │   ├── pipes/
│   │   │   └── validation.pipe.spec.ts                                 # LoginDto falla con mensaje tipado para email inválido
│   │   ├── providers/
│   │   │   ├── ai-provider.factory.spec.ts                             # Factory elige proveedor y aplica fallback
│   │   │   ├── base-ollama-ai.provider.spec.ts                         # Plantilla común de los proveedores Ollama
│   │   │   ├── ollama.client.spec.ts                                   # Cliente Ollama compartido: timeout y errores
│   │   │   ├── polyglot-draft-client.spec.ts                           # casos reales del tema «El clima» → significado repetido y término en otro alfabeto
│   │   │   └── speech-client.spec.ts                                   # motivo del 503 (motor ausente / servicio caído / inferencia), 400 por audio inválido y WARN una sola vez
│   │   ├── quiz/
│   │   │   └── spanish-text.spec.ts                                    # Prueba
│   │   ├── storage/
│   │   │   └── storage.spec.ts                                         # [Sprint 6.7] Zod (falla rápido sin mostrar secretos), S3ObjectStore sin red, LocalObjectStore, S3FileStorage y redirección firmada
│   │   ├── swagger/                                        # [Sprint 11.2] Decoradores y esquemas compartidos de Swagger
│   │   │   ├── api-decorators.spec.ts                      # @ApiAuth, @ApiStandardErrors y @ApiPaginatedResponse dejan los metadatos esperados en el documento OpenAPI
│   │   │   └── api-envelope.dto.spec.ts                    # ApiEnvelopeDto, ApiErrorDto y PageMetaDto coinciden con lo que escriben TransformInterceptor y HttpExceptionFilter
│   │   ├── use-cases/
│   │   │   ├── auth/
│   │   │   │   ├── login.use-case.spec.ts                              # [CREAR] UnauthorizedException si hash no coincide
│   │   │   │   ├── magic-link.use-cases.spec.ts                        # [CREAR, EDITAR] Respuesta genérica, solo el hash, canje de un solo uso (LoginUseCase.issue) y purga nocturna
│   │   │   │   ├── refresh-token.use-case.spec.ts                      # [EDITAR] Nuevo token emitido, viejo invalidado en BD
│   │   │   │   ├── register.use-case.spec.ts                           # [CREAR] Delega el alta en CreateUserUseCase con rol USER, crea sesión y emite evento
│   │   │   │   ├── request-password-reset.use-case.spec.ts             # [CREAR] Respuesta genérica, token con hash SHA-256 y correo enviado
│   │   │   │   ├── request-verify-email.use-case.spec.ts               # [CREAR] Respuesta genérica, token con hash SHA-256 y correo enviado
│   │   │   │   └── two-factor.use-cases.spec.ts                        # emisión del código por correo, canje de un solo uso y límite de intentos
│   │   │   ├── certificates/
│   │   │   │   └── certificates.use-cases.spec.ts                      # [CREAR, VER DETALLE, EDITAR] Emisión al 100 % idempotente, PDF real + SHA-256, anclaje por evento, verificación y revocación
│   │   │   ├── courses/
│   │   │   │   └── course-engagement.use-case.spec.ts                  # reglas de ⭐ favorito y 👍/❤️ reacción
│   │   │   ├── dialogues/
│   │   │   │   └── submit-user-turn.corrector.spec.ts                  # casos límite del corrector único en la conversación con el avatar
│   │   │   ├── feedback/
│   │   │   │   └── save-feedback.use-case.spec.ts                      # [CREAR] Guarda y reutiliza el feedback (fallback)
│   │   │   ├── fixes-2026-10-19/
│   │   │   │   └── fixes.use-cases.spec.ts                             # guion de diálogo desde una URL, «respuesta rápida» con cifras, título de tema traducido con caché y almacén nube + copia…
│   │   │   ├── fixes-2026-10-27/
│   │   │   │   ├── fail-soft-and-db-errors.spec.ts                     # título de tema Fail Soft (servicio de idiomas caído → 200 sin IPA), errores de PostgreSQL → 4xx legibles y texto
│   │   │   │   ├── guide-fallback.spec.ts                              # FastAPI/Ollama caídos → respuesta desde la FAQ y el manual (no 503), mismo protocolo SSE y aviso `degraded`
│   │   │   │   └── practice-draft-batches.spec.ts                      # cada inferencia pide ≤ PRACTICE_BATCH y un corte conserva lo ya generado
│   │   │   ├── fixes-2026-11-03/
│   │   │   │   ├── deck-image.spec.ts                                  # imagen por palabra del juego (miniatura data:image como vocabulario, o https) | nada ejecutable
│   │   │   │   ├── noun-grammar.spec.ts                                # artículo/género/plural por idioma + reparación de entradas incompletas
│   │   │   │   └── song-embed.spec.ts                                  # enlace de streaming → reproductor oficial embebido (el audio no se descarga)
│   │   │   ├── forums/
│   │   │   │   └── forums.use-cases.spec.ts                            # [CREAR, EDITAR, ELIMINAR] Acceso por inscripción, hilo cerrado, aviso al autor y moderación
│   │   │   ├── games/
│   │   │   │   └── deck-all-games.spec.ts                              # juegos del docente para TODOS los tipos (tabú, temas, escucha, role-play) + tema elegido del banco
│   │   │   ├── help/
│   │   │   │   └── help.use-cases.spec.ts                              # [CREAR, LISTAR, EDITAR] Manual idempotente, FAQ inicial sin duplicar, índice fail-soft, rol y valoración
│   │   │   ├── notifications/
│   │   │   │   └── email-outbox.use-cases.spec.ts                      # [CREAR, EDITAR] Guardar antes de enviar, envío idempotente, reintentos hasta «failed» y reintento manual
│   │   │   ├── payments/
│   │   │   │   ├── mercadopago-gateway.spec.ts                         # preferencia en COP, estado por external_reference y firma del webhook (x-signature) · `fetch` simulado (sin red)
│   │   │   │   └── payments.use-cases.spec.ts                          # [CREAR, EDITAR] Total en el servidor, webhook idempotente y reembolso total que revoca el acceso
│   │   │   ├── performance/
│   │   │   │   └── save-first-enrich-later.spec.ts                     # guardar primero y enriquecer en segundo plano, coalescing por clave,
│   │   │   ├── phase8/
│   │   │   │   └── phase8.use-cases.spec.ts                            # [CREAR, EDITAR] Cache-Aside de traducción, SM-2, evaluador por familia (incl. categoría), turno del agente, contenido con licencia y reglas de ítems
│   │   │   ├── phase9/
│   │   │   │   └── phase9.use-cases.spec.ts                            # [CREAR, EDITAR] Estados y licencia de canciones, letras con IPA, sincronización, prácticas, sesiones de diálogo y nivel confirmado
│   │   │   ├── phase10/
│   │   │   │   └── phase10.use-cases.spec.ts                           # [CREAR, EDITAR] «Aprender» con evento al mazo, orden de columnas, licencia de imágenes, IPA con revisión nativa, semillas y borrador de gramática validado
│   │   │   ├── quiz/
│   │   │   │   ├── end-session.use-case.spec.ts                        # [EDITAR] QuizCompleted event emitido con payload correcto
│   │   │   │   ├── exam-rules.spec.ts                                  # 3 intentos, 10 min entre intentos, 24 h tras 3 suspensos (2026-11-11), tiempo total por nivel y sorteo de preguntas
│   │   │   │   ├── generate-ai-questions.use-case.spec.ts              # [CREAR] Preguntas generadas por IA validadas
│   │   │   │   ├── strip-markup.spec.ts                                # el modelo dejaba «<text>…</text>» en el enunciado y se veía en el examen
│   │   │   │   └── submit-answer.use-case.spec.ts                      # [EDITAR] Respuesta registrada, sesión avanza
│   │   │   ├── reading/
│   │   │   │   ├── dictation-rule.spec.ts                              # un dictado necesita ≥ 3 párrafos de ≥ 5 frases (igual que una lectura generada)
│   │   │   │   └── reading.spec.ts                                     # división en frases, normalización del JSON de la IA, enriquecimiento por lotes con fallos parciales, reutilización de tr…
│   │   │   ├── score/
│   │   │   │   ├── calculate-score.use-case.spec.ts                    # Fórmula bonus correcta para cada dificultad
│   │   │   │   └── check-achievements.use-case.spec.ts                 # Logro desbloqueado cuando condición cumplida
│   │   │   ├── users/
│   │   │   │   ├── create-user.use-case.spec.ts                        # [CREAR] Email normalizado, Conflict si existe, hash con saltRounds de la config
│   │   │   │   ├── delete-account.use-case.spec.ts                     # [ELIMINAR] Baja con anonimización y revocación de sesiones
│   │   │   │   ├── get-profile.use-case.spec.ts                        # [VER DETALLE] Devuelve el perfil sin datos sensibles
│   │   │   │   ├── get-user-history.use-case.spec.ts                   # [LISTAR] Solo docentes; historial ordenado
│   │   │   │   └── update-profile.use-case.spec.ts                     # [EDITAR] Valida y emite ProfileUpdatedEvent
│   │   │   └── web3/
│   │   │       └── web3.use-cases.spec.ts                              # [CREAR, EDITAR] Firma SIWE real (sin red), verificación on-chain con FakeBlockchainAdapter y anclaje del hash
│   │   ├── utils/
│   │   │   ├── article-ipa.spec.ts                                     # la pronunciación incluye el artículo que se muestra (der Hund → /deːɐ̯ ˈhʊnt/)
│   │   │   ├── period.util.spec.ts                                     # Meses → fecha de corte
│   │   │   └── title-key.spec.ts                                       # regla anti-duplicados por título (normalización + 409 con mensaje en español)
│   │   └── value-objects/
│   │       ├── category.vo.spec.ts                                     # Categorías válidas e inválidas del examen
│   │       ├── course-category.vo.spec.ts                              # Categorías válidas e inválidas del curso
│   │       ├── email.vo.spec.ts                                        # Email inválido lanza DomainException
│   │       └── points.vo.spec.ts                                       # Points(-1) lanza excepción, Points(0) válido
│   └── usability/                                                      # USABILIDAD API — Jest + Supertest
│       ├── api-versioning.spec.ts                                      # /api/v1/* funciona y retorna versión en headers
│       ├── error-messages.spec.ts                                      # Errores 400/401/403/404/429 tienen formato consistente
│       ├── response-envelope.spec.ts                                   # Todas las respuestas siguen { data, meta } estándar
│       ├── swagger-contract.spec.ts                                    # [Sprint 11.2] OpenAPI real (AppModule preview): toda operación con tag + summary, operationId único, bearer
│       └── swagger-responses.spec.ts                                   # [Sprint 11.2] OpenAPI real: toda operación 2xx declara esquema de respuesta (cierra el pendiente «sin esquemas de respuesta»)
├── openapi/                                                            # [Sprint 11.2] OpenAPI exportado (artefacto generado, no se edita a mano)
│   └── openapi.json                                                    # OpenAPI 3 de NestJS (pnpm openapi:export): entrada de packages/api-client/generated.ts y del visor único
├── scripts/
│   ├── clean-offtopic-questions.js                                     # borra preguntas off-topic generadas por el bug de anchoring
│   ├── export-openapi.ts                                               # [Sprint 10.13] pnpm openapi:export: OpenAPI de NestJS sin base de datos (preview: true) para regenerar @aula/api-client
│   ├── inspect-questions.js                                            # lista preguntas por quiz para detectar mezcla de temas
│   ├── migrate-files-to-s3.ts                                          # [Sprint 6.7] pnpm storage:migrate: sube al bucket los archivos de UPLOADS_DIR (y con --legacy-buckets los buckets antiguos de MinIO); idempotente, con --dry-run
│   ├── seed-certificates.ts                                            # emite un certificado por nivel MCER (A1–C2) al usuario indicado para ver diploma, color y QR por nivel
│   ├── seed-music.ts                                                   # [Sprint 9.15] pnpm seed:music [--publish]: siete canciones tradicionales de dominio público (una por idioma) con colección, IPA, traducción y audio de espeak-ng; idempotente
│   └── seed-users.ts                                                   # evita dependencia adicional a dotenv
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json                                                   # Configuración
├── .dockerignore                                                       # Configuración
├── .env.example                                                        # Variables: DB_URL, JWT_SECRET, REDIS_URL, AI_URL · STORAGE_PROVIDER, S3_* y MAX_UPLOAD_MB sin valores reales (Sprint 6.7)
├── .gitignore                                                          # binarios de usuario, no van al repositorio
├── .prettierrc                                                         # Configuración
├── Dockerfile                                                          # build multi-etapa (compila → imagen final solo con dependencias de producción)
├── eslint.config.mjs                                                   # una librería por función (informe, «Política de dependencias»)
├── jest.config.ts                                                      # Coverage: branches 80% + functions 80%
├── jest.e2e.config.ts                                                  # Config E2E: testMatch **/*.e2e-spec.ts
├── nest-cli.json                                                       # Config CLI: sourceRoot, monorepo paths
├── nest_estructura.md                                                  # Documentación
├── nestjs-setup.md                                                     # Documentación
├── package.json                                                        # Configuración
├── pnpm-lock.yaml                                                      # Configuración
├── pnpm-workspace.yaml                                                 # qué dependencias pueden ejecutar scripts de instalación (por defecto ninguna)
├── README.md                                                           # Documentación
├── tsconfig.build.json                                                 # Build: excluye __tests__ + node_modules
├── tsconfig.json                                                       # strict:true + experimentalDecorators + emitDecoratorMetadata
└── typedoc.json                                                        # [Sprint 11.2] TypeDoc: documenta src/ (TSDoc) y se publica en el sitio MkDocs único
.github/workflows/
└── ci.yml                                                              # GitHub Actions: 3 jobs en paralelo (Next.js, NestJS, FastAPI) — lint, tipos, migraciones, pruebas y build (RF-78)
.husky/
└── pre-commit                                                          # git hook: corre lint-staged antes de cada commit (Husky v9)
/
├── .lintstagedrc.mjs                                                   # lint-staged del monorepo: ESLint (Frontend, backend) y ruff (ai-service) solo sobre archivos en stage
├── docker-compose.dev.yml                                              # PostgreSQL, Redis, MinIO, MailHog, pgAdmin y Ollama (RF-74)
└── mkdocs.yml                                                          # [Sprint 11.2] Sitio único de documentación: TypeDoc (Next.js, Angular y NestJS) + mkdocstrings (FastAPI) + visor de OpenAPI
infra/
├── backup/
│   └── backup.sh                                                       # copias periódicas de PostgreSQL y MinIO (RF-82)
└── nginx/
    └── nginx.conf                                                      # dominio único, HTTPS y rutas hacia Next.js y Angular (RF-79)
scripts/
├── llm-benchmark/
│   └── benchmark.mjs                                                   # compara modelos de Ollama con las MISMAS tareas y registra solo métricas medibles
├── add_classes_mdj.py                                                  # Agrega clases existentes en codigo (HashedPassword, Points, TokenType, AIProvider) al .mdj con vistas."""
├── add_figma_figures.py
├── add_figma_figures_v2.py
├── add_patterns_mdj.py                                                 # Agrega cluster de patrones quiz-IA al .mdj (todo existe en codigo):
├── append_docx_mcp_notifs.py                                           # Append section 10 to Auth_y_Docker.docx:
├── append_docx_protocols.py                                            # Append protocols + Redis + Docker validation section to Auth_y_Docker.docx
├── arch_dump.txt
├── build_thesis.py                                                     # Build updated thesis docx for ProyDemo y NeuroEdu IA. APA 7 formatting (Times New Roman 12, double spacing, 2.54cm margi…
├── check_all_notes.py
├── check_fig32_format.py
├── check_final_sequence.py
├── check_gap_45_46.py
├── check_images_820_860.py
├── check_images_final.py
├── check_note_size.py
├── check_para_runs.py
├── check_range.py
├── extract_docx.py
├── extract_docx2.py
├── find-empty-files.mjs                                                # [VER DETALLE] lista los archivos vacíos de marcador para completarlos o eliminarlos (RF-77)
├── fix_48_and_add_49.py
├── fix_all_after_48.py
├── fix_feedback_and_admin.py
├── fix_figma_styles.py
├── fix_image_after_48.py
├── fix_missing_46.py
├── fix_missing_47.py
├── fix_prueba2_v1.py
├── fix_prueba2_v2.py
├── fix_prueba2_v3.py
├── full_fix_numbering.py
├── gen_correcciones.py                                                 # Genera 'FORMATO PARA ENTREGA DE DOCUMENTO FINAL - 2024 3 Correcciones.docx'
├── gen_diagrams.py                                                     # Generador de los 10 diagramas drawio de ProyDemo — alineados ESTRICTAMENTE al codigo real
├── gen_diagrams_run.py                                                 # Builders de los 10 diagramas + main. Usa el core de gen_diagrams.py."""
├── generate-auth-docker-doc.py                                         # Genera Auth_y_Docker.docx con:
├── generate-staruml-mdj.py                                             # Genera archivos .mdj nativos de StarUML para los 9 diagramas de ProyDemo
├── inspect_45_46.py
├── inspect_after_48.py
├── inspect_figma_images.py
├── inspect_figma_images_v2.py
├── inspect_figma_images_v3.py
├── list_all_figs.py
├── master_cleanup_figs.py
├── patch_corecciones_F.py                                              # Patch the `CorreccionesF.docx` to:
├── patch_correcciones_purple_clean.py                                  # Second pass on `CorreccionesF.docx`:
├── patch_correcciones_table_purple.py                                  # Third pass on `CorreccionesF.docx`:
├── thesis_dump.txt
├── transform_endash.py                                                 # Final pass: en-dashes and Entidad-Relación style hyphens between Spanish words."""
├── transform_parens.py                                                 # Second-pass cleanup of build_thesis.py:
├── transform_script.py                                                 # Clean punctuation in build_thesis.py:
├── verify_styles.py
└── verify_v3.py
```

## Convenciones de nombres y reutilización CRUD (iguales en la matriz)

| Pieza | Nombre | Regla |
|-------|--------|-------|
| Carpeta del módulo | `modules/<módulo>/` | kebab-case, igual que el módulo de la matriz |
| Entidad | `domain/entities/<entidad>.entity.ts` | una por tabla; nombre de la entidad en kebab-case |
| Puerto | `domain/interfaces/<entidad>.repository.interface.ts` · `<servicio>.interface.ts` | un solo estilo (no `domain/ports/` ni `.port.ts`) |
| Repositorio | `infrastructure/repositories/<entidad>.repository.ts` | sin prefijo de tecnología (no `typeorm-…`) |
| Caso de uso | `application/use-cases/<verbo>-<entidad>.use-case.ts` | uno por acción (SRP) |
| DTOs | `create-<entidad>.dto.ts` · `update-<entidad>.dto.ts` · `<entidad>-response.dto.ts` | `Update<Entidad>Dto extends PartialType(Create<Entidad>Dto)`: los campos se escriben una sola vez (DRY) |
| Controlador | `presentation/<entidades>.controller.ts` | plural de la entidad con prefijo del módulo cuando el nombre se repite (`forum-threads`, `grammar-topics`, `dialogue-topics`) |
| CRUD genérico | `shared/application/topic-crud.service.ts` | Dialogues, Grammar y Polyglot reutilizan el mismo servicio de temas |

Cada fila de entidad de la matriz lista **solo sus archivos**; los archivos comunes del módulo (`*.module.ts`, adaptadores de IA, value objects compartidos) aparecen en la fila de la entidad principal.

**Nombres cortos y con sentido:** verbo + entidad, máximo unas 3 palabras antes del sufijo técnico; sin librerías, «my» ni detalles internos en el nombre (`link-wallet.use-case.ts`, no `verify-siwe-and-link-wallet.use-case.ts`; `get-audio`, no `get-or-create-audio`; `whisper_transcriber.py`, no `faster_whisper_transcriber.py`).

## Diccionario de Abreviaturas — NestJS

| Concepto / Sufijo | Significado | Patrón de Diseño | Principio SOLID |
|-------------------|-------------|------------------|-----------------|
| `domain/` | Capa sin dependencias externas | Clean Architecture núcleo | DIP |
| `application/` | Orquestación de casos de uso | Use Case Pattern | SRP |
| `infrastructure/` | Adapters concretos (BD, HTTP) | Hexagonal Architecture | DIP + OCP |
| `presentation/` | Controllers NestJS | MVC — capa de entrada | SRP |
| `.use-case.ts` | Lógica de negocio aislada | Command Pattern | SRP |
| `.entity.ts` | Objeto con identidad propia | DDD Entity | SRP |
| `.vo.ts` | Valor sin identidad, inmutable | DDD Value Object | SRP + OCP |
| `.interface.ts` | Port del dominio | Dependency Inversion | DIP + ISP |
| `.repository.ts` | Implementación del port de datos | Repository + Adapter | DIP + LSP |
| `.event.ts` | Evento de dominio inmutable | Observer + Event Sourcing | OCP |
| `.dto.ts` | Data Transfer Object tipado | Transfer Object Pattern | SRP |
| `.guard.ts` | Intercepta request por seguridad | Chain of Responsibility | SRP |
| `.interceptor.ts` | Cross-cutting concern AOP | Decorator + AOP | OCP |
| `.filter.ts` | Manejo centralizado de errores | Strategy (error handling) | SRP |
| `.pipe.ts` | Transformación y validación | Chain of Responsibility | SRP |
| `.decorator.ts` | Metadata custom con reflect | Decorator Pattern | OCP |
| `.strategy.ts` | Estrategia de autenticación | Strategy Pattern | OCP + DIP |
| `.gateway.ts` | WebSocket endpoint NestJS | Adapter (Socket.IO) | SRP |
| `.client.ts` | Cliente HTTP externo (Adapter); `ollama.client.ts` es el único hacia Ollama | Adapter Pattern | DIP + DRY |
| `.provider.ts` | Proveedor de LLM (Aya, Qwen, Mistral) sobre la clase base | Template Method + Strategy | OCP + LSP |
| `.port.ts` | Puerto del dominio (p. ej. BlockchainGatewayPort) | Ports & Adapters | DIP + ISP |
| `.adapter.ts` | Implementación del puerto (viem o falso para pruebas) | Adapter Pattern | DIP + LSP |
| `.processor.ts` | Trabajo en segundo plano con Bull | Saga / Outbox | SRP |
| `.config.ts` | Factory de configuración | Factory Pattern | SRP |
| `UC` | Use Case | Application Layer | SRP |
| `VO` | Value Object | Domain Layer | SRP |
| `Port` | Interface del dominio | DIP | DIP |
| `Adapter` | Implementación concreta del port | Hexagonal | DIP + OCP |
| `RBAC` | Role-Based Access Control | Security Pattern | SRP |
| `CV` | class-validator (decoradores) | Validation Pattern | SRP |
| `CT` | class-transformer | Transform Pattern | SRP |

## Leyenda de Prácticas Aplicadas

| Práctica | Dónde se aplica en la estructura |
|----------|----------------------------------|
| **SOLID — SRP** | Un use-case = una operación; un repositorio = un contexto |
| **SOLID — OCP** | Nuevos use-cases sin modificar existentes; ports + adapters |
| **SOLID — LSP** | Cualquier impl de IRepository reemplaza a otra sin romper |
| **SOLID — ISP** | Ports específicos por contexto (no mega-interfaces) |
| **SOLID — DIP** | Domain depende de IRepository, no de TypeORM directamente |
| **DRY** | shared/ centraliza guards, interceptors, decoradores comunes |
| **Clean Code** | Use-cases < 30 líneas, un método público por clase |
| **Type-Safe** | TS strict:true, class-validator en DTOs, Zod en dominio |
| **JWT Auth** | JwtAuthGuard global + @Public() para rutas abiertas |
| **RBAC** | @Roles() + RolesGuard + role en JWT claims |
| **Rate Limiting** | @Throttle() declarativo por endpoint o módulo |
| **OpenAPI** | @ApiTags, @ApiOperation, @ApiResponse en todos los controllers |
| **Rutas protegidas** | JwtAuthGuard aplicado globalmente, @Public() opt-out |

---

## Herramientas de Testing

| Librería | Tipo de Prueba | Para qué sirve |
|----------|---------------|----------------|
| Jest | Unitarias + Integración | Framework testing TypeScript: describe/it/expect, mocks automáticos, coverage |
| @nestjs/testing | Unitarias + Integración | TestingModule: crea módulos NestJS aislados con dependencias mockeadas |
| Supertest | Integración + Funcionales | Simula requests HTTP al servidor NestJS sin levantar puerto real |
| k6 | Rendimiento | Load testing: throughput, latencia p95/p99, escenarios de rampa de carga |
| Artillery | Rendimiento | Load testing declarativo YAML: SSE 1000 conexiones, escenarios multi-step |

## Validación de Datos

| Stack | Librerías | Por qué |
|-------|-----------|---------|
| Backend NestJS | **class-validator + class-transformer + Zod** | class-validator en DTOs con decoradores (@IsEmail, @MinLength); Zod en lógica de dominio y scripts de configuración |

## Herramientas de Calidad de Código

| Herramienta | Para qué |
|-------------|----------|
| ESLint + @typescript-eslint/eslint-plugin | Linter TypeScript con reglas estrictas: no-explicit-any, explicit-function-return-type |
| Prettier | Formateador de código — estilo consistente en todo el proyecto |
| TypeScript strict:true + experimentalDecorators | Type checking + soporte de decoradores NestJS |
| lint-staged + husky | Pre-commit hooks: ESLint + Prettier antes de cada commit |
| TypeDoc + MkDocs | Documentación de código TypeScript (TSDoc) de `src/`, publicada en el mismo sitio MkDocs que FastAPI (mkdocstrings) y el visor de OpenAPI |
