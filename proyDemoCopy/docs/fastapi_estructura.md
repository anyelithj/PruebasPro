# FastAPI 0.128 — Estructura de Carpetas

## Tipo de Arquitectura

**MVC + Hexagonal (Ports & Adapters) + Clean Architecture + async/await**

| Capa MVC        | Implementación en FastAPI                                                         |
|-----------------|-----------------------------------------------------------------------------------|
| **Model**       | `domain/entities/` · `domain/value_objects/` · Pydantic schemas · SQLAlchemy models |
| **View**        | Pydantic response schemas + `/docs` (Swagger) + `/redoc` auto-generados           |
| **Controller**  | `presentation/` Routers (`@router`) + `Depends()` middleware + auth               |
| **Lógica**      | `application/use_cases/` + asyncio.gather para procesamiento async                |
| **Persistencia**| `infrastructure/repositories/` SQLAlchemy async + Redis (implementan Ports)       |

**Patrones de Diseño:** Repository · Strategy (modelos IA intercambiables) · Factory (ModelFactory) · Adapter (OllamaClient compartido, SentenceTransformers) · Strategy por persona (agentes) y por tipo de ejercicio (evaluadores) · Fallback (modelo base del LLM propio) · Command (Use Cases) · Template Method (BaseUseCase) · Null Object

**Paradigmas:** OOP (clases Python) · Funcional (funciones puras) · Async/Await (asyncio) · Dirigido por Tipos (Pydantic v2 + mypy strict)

**Prácticas:** SOLID · DRY · Clean Code · Type-Safe (Pydantic v2 + mypy) · JWT validation · Dependency Injection nativa (FastAPI DI / Depends) · OpenAPI auto-gen · Rutas protegidas (`Depends(get_current_user)`)

**Tecnologías:** FastAPI 0.128 · Pydantic v2 · SQLAlchemy 2 async · PostgreSQL · Redis · spaCy · sentence-transformers · LangChain · FAISS · Ollama (OllamaClient compartido; LLM propio en GGUF) · Hugging Face PEFT + TRL (QLoRA del LLM propio, fuera de línea) · pytest · Locust · Ruff · Black · mypy

---

## Estructura de Carpetas Completa

> Árbol generado desde la matriz `matriz_trazabilidad_tecnica_AulaDeIdiomas (6).xlsx` (hoja «🤖 FastAPI Python», columna «Carpeta / Archivo (FBA)»): ambos documentos listan los mismos archivos con los mismos nombres. La etiqueta `[CREAR | LISTAR | VER DETALLE | EDITAR | ELIMINAR]` indica qué operación CRUD atiende cada archivo; en la matriz no se repiten las carpetas porque ya aparecen en la ruta de cada archivo.

```
apps/ai-service/                                    # MVC: View=schemas+/docs · Controller=presentation/ · Model=domain/
├── src/                                            # Código fuente de la aplicación
│   ├── modules/                                    # Bounded Contexts IA
│   │   ├── alignment/
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── align_request.py            # Pydantic v2 (request/response)
│   │   │   │   │   └── align_response.py           # Pydantic v2 (request/response)
│   │   │   │   └── use_cases/                      # Casos de uso
│   │   │   │       └── align_lines.py              # [CREAR] calcular inicio y fin de cada línea
│   │   │   ├── domain/                             # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   └── text_matching.py                # coincidencia aproximada entre las palabras transcritas y el texto
│   │   │   └── presentation/                       # Capa Presentación — entrada HTTP
│   │   │       └── alignment_router.py             # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   │   ├── analytics/                              # Contexto: Análisis y Métricas IA
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   └── analytics_response.py       # Pydantic: question_id, new_label, confidence
│   │   │   │   └── use_cases/                      # Casos de uso
│   │   │   │       ├── classify_difficulty.py      # UC: clustering K-means sobre tasa de error real
│   │   │   │       └── detect_anomalies.py         # UC: preguntas con respuesta atípica (outliers)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   └── difficulty_label.py         # Entidad: question_id, original, computed, confidence
│   │   │   │   └── interfaces/                     # Ports (DIP)
│   │   │   │       └── analytics_repository.py     # Interfaz de dominio (DIP) analytics repository py
│   │   │   ├── infrastructure/
│   │   │   │   └── models/                         # Modelos
│   │   │   │       └── classifier.py               # Adapter: scikit-learn KMeans + IsolationForest
│   │   │   └── presentation/                       # Capa Presentación — entrada HTTP
│   │   │       └── analytics_router.py             # GET /analytics/difficulty + /anomalies
│   │   ├── assistant/                              # Contexto: Agente Tutor IA Conversacional
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── chat_request.py             # Pydantic: message, session_id, persona y contexto (quiz, pantalla, juego o tema)
│   │   │   │   │   └── chat_response.py            # Pydantic: reply, sources[], session_id
│   │   │   │   └── use_cases/                      # Casos de uso
│   │   │   │       ├── chat_with_agent.py          # [CREAR] UC: turno conversación + RAG retrieval + LLM
│   │   │   │       ├── get_conversation.py         # [VER DETALLE] UC: historial de sesión de chat
│   │   │   │       ├── reindex_manual.py           # [CREAR] divide el manual por sección y reconstruye el índice FAISS
│   │   │   │       ├── search_faq.py               # [LISTAR] búsqueda de FAQ por similitud (umbral)
│   │   │   │       └── upsert_faq_embeddings.py    # [CREAR] embeddings de las FAQ publicadas por NestJS
│   │   │   ├── domain/
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   └── conversation.py             # Entidad: session_id, messages[], context, user_id
│   │   │   │   ├── interfaces/                     # Ports (DIP)
│   │   │   │   │   ├── agent.py                    # Port (Protocol): interfaz agente IA (DIP)
│   │   │   │   │   ├── game_engine.py              # GameEngine (motor determinista de un juego)
│   │   │   │   │   └── vector_store.py             # Port (Protocol): búsqueda vectorial
│   │   │   │   └── value_objects/                  # Value Objects
│   │   │   │       ├── game_context.py             # contexto del juego: tipo, objetivo, prohibidas, turno y objetivos cumplidos
│   │   │   │       ├── message.py                  # VO: role (user|assistant) + content + timestamp
│   │   │   │       ├── persona.py                  # Persona: tutor | guide | game | dialogue
│   │   │   │       ├── screen_context.py           # contexto de pantalla del Agente Guía (ruta + rol + idioma)
│   │   │   │       └── topic_script.py             # apertura y objetivos de un tema de diálogo (determinista)
│   │   │   ├── infrastructure/
│   │   │   │   ├── agents/                         # Agentes
│   │   │   │   │   ├── agent_factory.py            # elige el agente según la persona (Strategy)
│   │   │   │   │   ├── dialogue_agent.py           # persona de diálogo: tema, nivel e historial
│   │   │   │   │   ├── game_agent.py               # persona de juegos: delega en el motor del juego y usa el LLM solo para la jugada libre
│   │   │   │   │   ├── guide_agent.py              # persona guía: FAQ → manual (RAG) → LLM; cita la sección del manual
│   │   │   │   │   └── tutor_agent.py              # Impl LangChain ReAct agent con herramientas
│   │   │   │   ├── clients/
│   │   │   │   │   ├── faq_retriever.py            # FaqRetriever (FAISS + sentence-transformers)
│   │   │   │   │   └── manual_retriever.py         # ManualRetriever (RAG sobre el mismo FaissStore)
│   │   │   │   ├── games/                          # Motores de juego (Strategy)
│   │   │   │   │   ├── chained_story_engine.py     # historia encadenada
│   │   │   │   │   ├── debate_engine.py            # debate rápido
│   │   │   │   │   ├── describe_guess_engine.py    # describe y adivina
│   │   │   │   │   ├── role_play_engine.py         # role-play con escenario y objetivos
│   │   │   │   │   ├── taboo_engine.py             # tabú y palabra prohibida
│   │   │   │   │   └── twenty_questions_engine.py  # 20 preguntas (respuestas sí/no deterministas)
│   │   │   │   ├── repositories/                   # Repositorios (implementan los ports)
│   │   │   │   │   └── conversation_repository.py  # [CREAR, LISTAR, VER DETALLE] Impl Redis (sesiones TTL 24h)
│   │   │   │   └── vector_stores/                  # Almacenes vectoriales
│   │   │   │       └── faiss_store.py              # Impl FAISS del port VectorStore
│   │   │   └── presentation/                       # Capa Presentación — entrada HTTP
│   │   │       └── assistant_router.py             # [CREAR, LISTAR, VER DETALLE] POST /assistant/chat + GET /assistant/{session_id}
│   │   ├── feedback/                               # Contexto: Feedback Pedagógico
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── feedback_request.py         # Pydantic: question, answer, history, user_level
│   │   │   │   │   └── feedback_response.py        # Pydantic: feedback, recommendations[], study_plan
│   │   │   │   └── use_cases/                      # Casos de uso
│   │   │   │       ├── analyze_weaknesses.py       # [CREAR] UC: detectar conceptos con < 60% acierto
│   │   │   │       ├── generate_feedback.py        # [CREAR] UC: feedback inmediato por respuesta incorrecta
│   │   │   │       ├── generate_recommendation.py  # [CREAR] UC: plan de estudio personalizado
│   │   │   │       └── generate_study_plan.py      # [CREAR] UC: ruta de aprendizaje ordenada por prioridad
│   │   │   ├── domain/
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   ├── feedback.py                 # Entidad: texto, tipo, recursos, user_id, quiz_id · ⚠ archivo vacío (marcador)
│   │   │   │   │   └── recommendation.py           # Entidad: temas, prioridad, recursos_url, plan · ⚠ archivo vacío (marcador)
│   │   │   │   ├── interfaces/                     # Ports (DIP)
│   │   │   │   │   ├── feedback_repository.py      # [CREAR, VER DETALLE] Port (Protocol) · ⚠ archivo vacío (marcador)
│   │   │   │   │   └── llm_client.py               # Port (Protocol): generar texto con LLM (DIP)
│   │   │   │   └── value_objects/                  # Value Objects
│   │   │   │       └── feedback_type.py            # VO: CORRECTION | HINT | EXPLANATION | MOTIVATION
│   │   │   ├── infrastructure/
│   │   │   │   ├── clients/                        # Clientes externos (Adapter)
│   │   │   │   │   ├── ollama_client.py            # Adapter: Ollama LLM local; único cliente de Ollama del servicio de IA (lo reutilizan Assistant, Grading, LanguageTools y LevelClassifier mediante LlmPort)
│   │   │   │   │   └── rag_retriever.py            # Adapter: FAISS vector search para contexto RAG
│   │   │   │   └── repositories/                   # Repositorios (implementan los ports)
│   │   │   │       └── feedback_repository.py      # [CREAR, VER DETALLE] Impl SQLAlchemy async · ⚠ archivo vacío (marcador)
│   │   │   └── presentation/                       # Capa Presentación — entrada HTTP
│   │   │       └── feedback_router.py              # [CREAR, VER DETALLE] POST /feedback/generate + /analyze + /study-plan
│   │   ├── grading/                                # Contexto: Calificación Automática
│   │   │   ├── application/                        # Capa Aplicación — casos de uso (SRP)
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── evaluate_request.py         # Pydantic v2: ítem de práctica, respuesta y tipo de ejercicio
│   │   │   │   │   ├── evaluate_response.py        # Pydantic v2: hallazgos, respuesta correcta y consejo
│   │   │   │   │   ├── grading_request.py          # Pydantic v2: answer, question, type, language
│   │   │   │   │   └── grading_response.py         # Pydantic v2: score, confidence, explanation
│   │   │   │   └── use_cases/                      # Casos de uso
│   │   │   │       ├── batch_grade.py              # [CREAR] UC: calificar N respuestas en paralelo (asyncio.gather)
│   │   │   │       ├── evaluate_attempt.py         # [CREAR] evaluar la respuesta de práctica y clasificar los errores
│   │   │   │       ├── generate_rubric.py          # [CREAR] ⚠ archivo vacío (marcador): se elimina; las rúbricas las genera NestJS Curriculum
│   │   │   │       └── grade_answer.py             # [CREAR] UC: elegir Strategy + calificar + retornar Score
│   │   │   ├── domain/                             # Capa Dominio — sin imports externos (DIP)
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   └── grading_result.py           # Entidad: score, confidence, method, question_id
│   │   │   │   ├── interfaces/                     # Ports (DIP)
│   │   │   │   │   ├── grading_model.py            # Port (Protocol): interfaz modelo IA (DIP)
│   │   │   │   │   └── grading_repository.py       # [CREAR, VER DETALLE] Port (Protocol): persistir + consultar resultados · ⚠ archivo vacío (marcador)
│   │   │   │   └── value_objects/                  # Value Objects
│   │   │   │       ├── confidence.py               # VO: HIGH | MEDIUM | LOW basado en threshold
│   │   │   │       └── score.py                    # VO: float 0.0-1.0 con validación inmutable
│   │   │   ├── infrastructure/                     # Capa Infraestructura — Adapters concretos
│   │   │   │   ├── evaluators/                     # Evaluadores de práctica (Strategy por tipo de ejercicio)
│   │   │   │   │   ├── fill_blank_evaluator.py     # completar y opción múltiple
│   │   │   │   │   ├── mark_errors_evaluator.py    # [EDITAR] marcar errores (gramática y vocabulario)
│   │   │   │   │   ├── open_answer_evaluator.py    # respuesta abierta (semántica y explicación con LLM)
│   │   │   │   │   ├── order_evaluator.py          # ordenar por arrastre (estructura)
│   │   │   │   │   └── skill_error.py              # tipo de error según la habilidad del ítem (estructura → word_order, vocabulario → vocabulary)
│   │   │   │   ├── models/                         # Modelos
│   │   │   │   │   ├── exact_match_model.py        # Adapter: Strategy exact match (objetivas)
│   │   │   │   │   ├── model_factory.py            # Factory: elige modelo según tipo de pregunta
│   │   │   │   │   ├── nlp_model.py                # Adapter: spaCy pipeline para análisis semántico
│   │   │   │   │   └── similarity_model.py         # Adapter: sentence-transformers cosine similarity
│   │   │   │   └── repositories/                   # Repositorios (implementan los ports)
│   │   │   │       └── grading_repository.py       # [CREAR, VER DETALLE] Impl SQLAlchemy async del port grading_repository · ⚠ archivo vacío (marcador)
│   │   │   └── presentation/                       # Capa Presentación — entrada HTTP
│   │   │       └── grading_router.py               # [CREAR, VER DETALLE] FastAPI Router: POST /grading/grade + /batch + /practice
│   │   ├── language_tools/
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── ipa_request.py              # Pydantic v2 (request/response)
│   │   │   │   │   ├── lines_request.py            # Pydantic v2 (request/response)
│   │   │   │   │   ├── lookup_response.py          # [VER DETALLE] Pydantic v2 (request/response)
│   │   │   │   │   ├── speak_request.py            # [CREAR] Pydantic v2: texto, idioma y variante BCP-47
│   │   │   │   │   ├── translate_request.py        # Pydantic v2 (request/response)
│   │   │   │   │   └── word_request.py             # Pydantic v2 (request/response)
│   │   │   │   └── use_cases/                      # Casos de uso
│   │   │   │       ├── enrich_lines.py             # [CREAR] traducir y transcribir a IPA cada línea de una letra o de un diálogo
│   │   │   │       ├── lookup_term.py              # [CREAR] orquestar traducción e IPA en paralelo
│   │   │   │       ├── lookup_word.py              # [CREAR] traducir una palabra según su frase, transcribirla y dar ejemplos breves
│   │   │   │       ├── synthesize_speech.py        # [CREAR] voz de la variante → WAV (POST /language-tools/speak)
│   │   │   │       ├── transcribe_ipa.py           # [CREAR] transcribir a IPA por palabra y completa
│   │   │   │       └── translate_text.py           # [CREAR] traducir un término o una frase
│   │   │   ├── domain/                             # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── llm_client.py               # LlmPort (se reutiliza el cliente de Ollama)
│   │   │   │   │   ├── phonetizer.py               # Phonetizer
│   │   │   │   │   └── speech_synthesizer.py       # SpeechSynthesizer (texto + voz → WAV) y SpeechUnavailableError 503
│   │   │   │   └── language_voices.py              # idioma → voz de espeak-ng (en-gb y en-us, fr-fr, de, es, pt-br y pt-pt, cmn, ru)
│   │   │   ├── infrastructure/
│   │   │   │   └── clients/                        # Clientes externos (Adapter)
│   │   │   │       ├── espeak_phonetizer.py        # EspeakPhonetizer (ejecuta el binario espeak-ng; no usa el LLM)
│   │   │   │       └── espeak_speech.py            # espeak-ng local (texto por stdin, sin shell; funciona con cualquier event loop)
│   │   │   └── presentation/                       # Capa Presentación — entrada HTTP
│   │   │       └── language_tools_router.py        # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   │   ├── level_classifier/
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── classify_request.py         # Pydantic v2 (request/response)
│   │   │   │   │   └── classify_response.py        # Pydantic v2 (request/response)
│   │   │   │   └── use_cases/                      # Casos de uso
│   │   │   │       └── classify_text.py            # [CREAR] estimar el nivel CEFR de un texto o diálogo
│   │   │   ├── domain/
│   │   │   │   └── value_objects/                  # Value Objects
│   │   │   │       └── estimated_level.py          # nivel estimado (nivel, confianza e indicadores)
│   │   │   ├── infrastructure/
│   │   │   │   ├── clients/                        # Clientes externos (Adapter)
│   │   │   │   │   └── cefr_rubric_judge.py        # juicio con rúbrica CEFR mediante el LLM local
│   │   │   │   └── measures/
│   │   │   │       └── text_measures.py            # longitud media de oración y de palabra, riqueza léxica y proporción de palabras poco frecuentes
│   │   │   └── presentation/                       # Capa Presentación — entrada HTTP
│   │   │       └── level_classifier_router.py      # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   │   ├── own_llm/                                # LLM propio: corrector pedagógico de redacciones (RF-144)
│   │   │   ├── application/
│   │   │   │   ├── schemas/
│   │   │   │   │   ├── writing_request.py          # Pydantic v2: texto, idioma y nivel CEFR (7 idiomas · A1–C2; modelo propio solo en inglés, el resto va al modelo base)
│   │   │   │   │   └── writing_response.py         # Pydantic v2: errores marcados (ErrorFinding), corrección y explicación en español
│   │   │   │   └── use_cases/
│   │   │   │       ├── correct_writing.py          # [CREAR] corrige con el LLM propio; si falla, usa el modelo base
│   │   │   │       └── get_model_card.py           # [VER DETALLE] versión, cuantización y métricas de evaluación del modelo publicado
│   │   │   ├── infrastructure/
│   │   │   │   └── models/
│   │   │   │       └── writing_corrector_model.py  # aula-corrector en Ollama mediante el OllamaClient compartido; respaldo al modelo base
│   │   │   └── presentation/
│   │   │       └── own_llm_router.py               # [CREAR, LISTAR, VER DETALLE] POST /own-llm/correct + GET /own-llm/scope + /own-llm/model
│   │   └── speech/
│   │       ├── application/
│   │       │   ├── schemas/                        # Esquemas Pydantic v2
│   │       │   │   ├── fluency_request.py          # Pydantic v2 (request/response)
│   │       │   │   └── transcribe_response.py      # Pydantic v2 (request/response)
│   │       │   └── use_cases/                      # Casos de uso
│   │       │       ├── analyze_fluency.py          # [CREAR] calcular métricas de fluidez
│   │       │       └── transcribe_audio.py         # [CREAR] transcribir audio con marcas de tiempo por palabra
│   │       ├── domain/                             # Capa Dominio — sin dependencias externas (DIP)
│   │       │   ├── interfaces/
│   │       │   │   └── speech_to_text.py           # SpeechToText
│   │       │   └── fluency_metrics.py              # latencia, pausas, palabras por minuto y vocabulario reutilizado
│   │       └── presentation/                       # Capa Presentación — entrada HTTP
│   │           └── speech_router.py                # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   ├── shared/                                     # Cross-Cutting Concerns
│   │   ├── clients/                                # Clientes compartidos (Adapter)
│   │   │   ├── llm_json.py                         # pedir JSON al LLM y validarlo (DRY entre LanguageTools, Assistant y Grading)
│   │   │   └── whisper_transcriber.py              # WhisperTranscriber (faster-whisper, CPU, cuantizado); lo usan Speech y Alignment (DRY)
│   │   ├── config/                                 # Configuración
│   │   │   ├── database.py                         # SQLAlchemy async engine + AsyncSessionLocal
│   │   │   └── settings.py                         # Pydantic BaseSettings: DB_URL, REDIS_URL, OLLAMA_URL
│   │   ├── dependencies/                           # Inyección de dependencias (Depends)
│   │   │   ├── auth_deps.py                        # get_current_user(): Depends() extrae user del JWT
│   │   │   ├── db_deps.py                          # get_db(): AsyncSession yield con cierre garantizado
│   │   │   └── model_deps.py                       # get_model(): Factory inyecta modelo IA correcto · carga el codificador desde la caché local sin consultar el Hub (descarga solo la primera vez)
│   │   ├── domain/
│   │   │   ├── error_finding.py                    # hallazgo (tipo, posición, corrección y explicación); lo usan Grading y OwnLlm (DRY)
│   │   │   └── text_norm.py                        # normalizar texto y partir en palabras (DRY entre juegos y práctica)
│   │   ├── exceptions/                             # Excepciones
│   │   │   ├── custom_errors.py                    # Tipos error dominio IA: ModelError, GradingError
│   │   │   └── handlers.py                         # Global exception_handlers: HTTPException, ValueError
│   │   └── middleware/                             # Middleware
│   │       ├── auth_middleware.py                  # JWT decode + inject current_user en request state
│   │       ├── cors_middleware.py                  # CORS config: origins, methods, credentials
│   │       └── logging_middleware.py               # Request/response logging con duración ms
│   ├── main.py                                     # FastAPI app: lifespan + routers + middleware + OpenAPI · silencia los registros de httpx, huggingface_hub y faiss.loader
│   └── routers.py                                  # APIRouter: incluye todos los routers de módulos
├── alembic/                                        # Migraciones de BD versionadas
│   ├── versions/
│   │   └── 001_initial_schema.py                   # Tablas: grading_results, feedback, conversations
│   └── env.py                                      # Config alembic con SQLAlchemy async
├── tests/                                          # ══ PRUEBAS ══════════════════════════════
│   ├── evaluation/                                 # Evaluación de calidad (conjunto de referencia y conjunto reservado)
│   │   └── run_eval.py                             # JSON válido ≥ 98 %, mejora vs. modelo base, docentes ≥ 4/5 y latencia RNF-03; compara también Aya, Qwen y Mistral
│   ├── functional/                                 # FUNCIONALES (E2E) — pytest + httpx
│   │   ├── test_assistant_flow.py                  # Chat 3 turnos con contexto RAG sobre tema quiz
│   │   ├── test_auth_protection.py                 # Endpoints sin JWT retornan 401 correctamente
│   │   ├── test_batch_flow.py                      # 50 respuestas batch → asyncio.gather → todos los resultados
│   │   ├── test_feedback_flow.py                   # Quiz con errores → análisis → plan estudio completo
│   │   └── test_grading_flow.py                    # Enviar respuesta → score → explicación → persistir: < 5s
│   ├── integration/                                # INTEGRACIÓN — pytest + httpx TestClient
│   │   ├── analytics/
│   │   │   └── test_analytics_router.py            # GET /analytics/difficulty → labels actualizados
│   │   ├── assistant/
│   │   │   ├── test_assistant_router.py            # [CREAR, LISTAR, VER DETALLE] POST /assistant/chat → 200 + reply + sources no vacío
│   │   │   └── test_conversation_state.py          # 3 turnos: agente mantiene contexto del turno 1
│   │   ├── feedback/
│   │   │   ├── test_feedback_router.py             # [CREAR, VER DETALLE] POST /feedback/generate → 200 + texto no vacío
│   │   │   └── test_study_plan_router.py           # [CREAR, VER DETALLE] POST /feedback/study-plan → plan con N etapas
│   │   └── grading/
│   │       ├── test_batch_grading.py               # POST /grading/batch → 202 + job_id + resultado en Redis
│   │       └── test_grading_router.py              # [CREAR, VER DETALLE] POST /grading/grade → 200 + score válido + persistido en BD
│   ├── performance/                                # RENDIMIENTO — Locust
│   │   ├── scenarios/
│   │   │   ├── assistant_load.py                   # 50 VUs: POST /assistant/chat p95 < 3s (LLM local)
│   │   │   ├── batch_throughput.py                 # 1000 respuestas batch procesadas en < 30s
│   │   │   ├── feedback_load.py                    # 100 VUs: POST /feedback/generate p95 < 2s
│   │   │   └── grading_load.py                     # 200 VUs: POST /grading/grade p95 < 500ms
│   │   ├── locust.conf                             # Config: host, users, spawn-rate, run-time
│   │   └── locustfile.py                           # Scenarios: GradingUser, FeedbackUser, AssistantUser
│   ├── unit/                                       # UNITARIAS — pytest
│   │   ├── models/
│   │   │   ├── test_model_factory.py               # Factory retorna ExactMatch para multiple-choice
│   │   │   └── test_similarity_model.py            # cosine > 0.85 para sinónimos, < 0.3 para antónimos
│   │   ├── schemas/
│   │   │   ├── test_chat_schemas.py                # session_id UUID válido obligatorio
│   │   │   ├── test_feedback_schemas.py            # ValidationError si history no es lista
│   │   │   └── test_grading_schemas.py             # ValidationError si answer vacío o score fuera de rango
│   │   ├── use_cases/
│   │   │   ├── alignment/
│   │   │   │   └── test_align_lines.py             # [CREAR] tiempos por línea desde las marcas de palabra y propuesta con confianza en canciones
│   │   │   ├── assistant/
│   │   │   │   ├── test_chat_with_agent.py         # [CREAR] RAG mockeado + LLM mockeado → respuesta con sources
│   │   │   │   ├── test_dialogue_agent.py          # [CREAR] apertura determinista por tema, respuesta dentro del tema y del nivel y corrección suave
│   │   │   │   ├── test_game_agent.py              # [CREAR] motores deterministas de los seis juegos y respaldo cuando el LLM no responde
│   │   │   │   ├── test_guide_agent.py             # [CREAR] Agente Guía: FAQ sin LLM → manual con citas y rol → «no lo sé»
│   │   │   │   └── test_get_conversation.py        # [VER DETALLE] Redis mockeado retorna historial correcto
│   │   │   ├── feedback/
│   │   │   │   ├── test_analyze_weaknesses.py      # [CREAR] Agrupa errores por categoría correctamente
│   │   │   │   ├── test_generate_feedback.py       # [CREAR] LLM mockeado → feedback no vacío para respuesta incorrecta
│   │   │   │   └── test_generate_study_plan.py     # [CREAR] Plan ordenado por prioridad descendente
│   │   │   ├── grading/
│   │   │   │   ├── test_batch_grade.py             # [CREAR] N calificaciones lanzadas en paralelo con asyncio.gather
│   │   │   │   ├── test_evaluate_attempt.py        # [CREAR] un evaluador por tipo de ítem: huecos, orden, marcar errores y respuesta abierta
│   │   │   │   ├── test_generate_rubric.py         # [CREAR] LLM mockeado retorna rubrica con N criterios
│   │   │   │   └── test_grade_answer.py            # [CREAR] Score=1.0 para respuesta idéntica, score≈0 para irrelevante
│   │   │   ├── language_tools/
│   │   │   │   ├── test_lookup.py                  # [CREAR] traducción con LLM falso + IPA real de espeak-ng UK/US en paralelo
│   │   │   │   └── test_synthesize_speech.py       # [CREAR] voces, caso de uso y espeak-ng real en los 7 idiomas
│   │   │   ├── level_classifier/
│   │   │   │   └── test_classify_text.py           # [CREAR] indicadores medidos primero y rúbrica del LLM solo en casos dudosos
│   │   │   ├── speech/
│   │   │   │   └── test_speech.py                  # [CREAR] faster-whisper transcribe audio real de espeak y métricas de fluidez puras
│   │   │   └── own_llm/
│   │   │       └── test_correct_writing.py         # [CREAR] cadena de respaldo, contrato JSON, ubicación de errores y umbrales de run_eval
│   │   └── value_objects/
│   │       ├── test_confidence.py                  # Threshold correcto para HIGH/MEDIUM/LOW
│   │       └── test_score.py                       # Score(1.1) lanza ValueError, Score(0.0) válido
│   ├── usability/                                  # USABILIDAD API — pytest + httpx
│   │   ├── test_docs_endpoint.py                   # GET /docs y /redoc responden 200 en todos los envs
│   │   ├── test_error_messages.py                  # 400/401/422/500 tienen message descriptivo en español
│   │   ├── test_openapi_contract.py                # Todos los endpoints en /openapi.json con schemas completos
│   │   └── test_response_consistency.py            # Todas las respuestas siguen schema Pydantic declarado
│   └── conftest.py                                 # Fixtures compartidas de pytest (cliente y BD de prueba)
├── training/                                       # Ajuste fino fuera de línea (no se despliega con el servicio)
│   └── writing_corrector/
│       ├── export_gguf.py                          # fusiona el adaptador y exporta a GGUF cuantizado
│       ├── Modelfile                               # registra el GGUF en Ollama (OLLAMA_CORRECTOR_MODEL)
│       ├── prepare_dataset.py                      # correcciones revisadas por docentes + sintéticos revisados; separa el conjunto reservado
│       └── train_qlora.py                          # QLoRA con Hugging Face PEFT y TRL sobre el modelo base
├── .env.example                                    # DB_URL, REDIS_URL, OLLAMA_URL, OLLAMA_MODEL, OLLAMA_CORRECTOR_MODEL, JWT_SECRET, NEST_URL
├── Dockerfile                                      # Multi-stage: builder + runner (imagen mínima)
├── pyproject.toml                                  # Ruff + black + mypy + pytest markers config
├── pytest.ini                                      # asyncio_mode=auto + coverage + markers definidos
├── requirements-dev.txt                            # Testing: pytest, httpx, factory-boy, faker, locust
└── requirements.txt                                # Dependencias producción (pin de versiones)
```

## Convenciones de nombres y reutilización (iguales en la matriz)

| Pieza | Nombre | Regla |
|-------|--------|-------|
| Carpeta del módulo | `modules/<módulo>/` | snake_case, igual que el módulo de la matriz |
| Entidad | `domain/entities/<entidad>.py` | nombre de la entidad en snake_case |
| Puerto | `domain/interfaces/<nombre>.py` | un solo estilo (no `domain/ports/`) |
| Repositorio | `infrastructure/repositories/<entidad>_repository.py` | sufijo completo `_repository` (no `_repo`) |
| Caso de uso | `application/use_cases/<verbo>_<entidad>.py` | uno por acción (SRP) |
| Esquemas | `application/schemas/<acción>_request.py` · `<acción>_response.py` | Pydantic v2: `<Entidad>Base` con los campos comunes y `Create` / `Update` / `Read` heredan de ella (DRY) |
| Router | `presentation/<módulo>_router.py` | uno por módulo |

**Nombres cortos y con sentido:** verbo + entidad, máximo unas 3 palabras antes del sufijo técnico; sin librerías, «my» ni detalles internos en el nombre (`link-wallet.use-case.ts`, no `verify-siwe-and-link-wallet.use-case.ts`; `get-audio`, no `get-or-create-audio`; `whisper_transcriber.py`, no `faster_whisper_transcriber.py`).

## Diccionario de Abreviaturas — FastAPI

| Concepto / Sufijo | Significado | Patrón de Diseño | Principio SOLID |
|-------------------|-------------|------------------|-----------------|
| `domain/` | Capa sin imports externos | Clean Architecture núcleo | DIP |
| `application/` | Orquestación de casos de uso | Use Case Pattern | SRP |
| `infrastructure/` | Adapters concretos (BD, modelos) | Hexagonal Architecture | DIP + OCP |
| `presentation/` | FastAPI Routers | MVC — capa de entrada | SRP |
| `use_case.py` | Lógica de negocio IA | Command Pattern | SRP |
| `.entity` (clase) | Objeto con identidad propia | DDD Entity | SRP |
| `.vo` (VO clase) | Valor inmutable con invariantes | DDD Value Object | SRP + OCP |
| `Port` | Protocol Python (interfaz) | Dependency Inversion | DIP + ISP |
| `Adapter` | Implementación concreta del port | Hexagonal + Adapter GoF | DIP + OCP |
| `schema.py` | Validación Pydantic v2 | Type-Safe input/output | SRP |
| `model_factory.py` | Selección dinámica de modelo IA | Factory + OCP | OCP + DIP |
| `Strategy` | Algoritmo IA intercambiable | Strategy Pattern | OCP |
| `grading_repository.py` | Repositorio de resultados IA | Repository Pattern | DIP |
| `ollama_client.py` | Único cliente de Ollama del servicio de IA | Adapter Pattern | DIP + DRY |
| `own_llm/` | Módulo del LLM propio: corrector de redacciones con respaldo al modelo base | Adapter + Fallback | SRP |
| `error_finding.py` | Hallazgo compartido por grading y own_llm | Value Object | DRY |
| `evaluators/` | Evaluador por tipo de ejercicio de práctica | Strategy | OCP |
| `agent_factory.py` | Agente según la persona (tutor, guía, juego, diálogo) | Factory + Strategy | OCP + SRP |
| `training/` | Ajuste fino QLoRA (PEFT + TRL) y exportación a GGUF | Pipeline fuera de línea | SRP |
| `run_eval.py` | Evaluación de calidad con conjunto de referencia | Test harness | — |
| `rag_retriever.py` | Recuperación semántica contextual | Retrieval Pattern (RAG) | DIP |
| `tutor_agent.py` | Agente LangChain ReAct | Agent Pattern | SRP |
| `faiss_store.py` | Vector store semántico | Repository + Adapter | DIP |
| `conversation_repository.py` | Repositorio Redis (sesiones) | Repository + TTL | SRP |
| `auth_deps.py` | Dependency Injection FastAPI | DIP vía Depends() | DIP |
| `db_deps.py` | Session factory async | Factory + DIP | DIP |
| `model_deps.py` | Factory de modelo IA via DI | Factory + DIP | DIP |
| `settings.py` | Config type-safe con Pydantic | Config Object | SRP |
| `lifespan` | Startup/shutdown en main.py | Template Method | SRP |
| `asyncpg` | Driver async PostgreSQL | Performance Adapter | — |
| `asyncio.gather` | Concurrencia I/O en el caso de uso | Fan-Out | OCP |
| `FAISS` | Búsqueda vectorial en memoria | Retrieval Pattern | — |
| `RAG` | Retrieval-Augmented Generation | Architecture Pattern IA | — |
| `UC` | Use Case | Application Layer | SRP |
| `VO` | Value Object | Domain Layer | SRP |
| `DI` | Dependency Injection FastAPI | DIP en runtime | DIP |

## Leyenda de Prácticas Aplicadas

| Práctica | Dónde se aplica en la estructura |
|----------|----------------------------------|
| **SOLID — SRP** | Un use_case.py = una operación de negocio IA |
| **SOLID — OCP** | Nuevo modelo IA: crear adapter + registrar en factory (sin tocar dominio) |
| **SOLID — LSP** | Cualquier impl del Port grading_model.py es intercambiable |
| **SOLID — ISP** | Ports específicos: GradingModel separado de LLMClient |
| **SOLID — DIP** | Domain importa Protocol (interface), no implementación concreta |
| **DRY** | shared/dependencies/ centraliza auth, db, model injection |
| **Clean Code** | Funciones < 20 líneas, un return por use_case, nombres descriptivos |
| **Type-Safe** | Pydantic v2 en todos los schemas, mypy strict, Protocol para ports |
| **JWT Auth** | auth_middleware.py + get_current_user() Depends() en cada router |
| **OpenAPI** | FastAPI auto-genera /docs y /redoc con todos los schemas Pydantic |
| **Async** | asyncpg + SQLAlchemy async + asyncio en todos los use_cases |
| **Rutas protegidas** | Depends(get_current_user) en routers que requieren autenticación |

---

## Herramientas de Testing

| Librería | Tipo de Prueba | Para qué sirve |
|----------|---------------|----------------|
| pytest | Todas las capas | Framework testing Python: fixtures, markers, parametrize, asyncio_mode=auto |
| pytest-asyncio | Unitarias + Integración | Soporte async/await en tests: asyncio_mode=auto para corrutinas |
| pytest-cov | Todas | Cobertura de código con reporte HTML y XML para CI |
| httpx (TestClient) | Integración + Funcionales | TestClient async de FastAPI para tests de routers sin servidor real |
| factory-boy | Integración + Funcionales | Factories de objetos para datos de prueba — DRY en fixtures |
| faker | Integración + Funcionales | Generación de datos falsos realistas en español/inglés |
| Locust | Rendimiento | Load testing Python: simula N usuarios concurrentes con escenarios IA |
| run_eval.py (pytest) | Calidad de los modelos | Compara el LLM propio con su modelo base y entre Aya, Qwen y Mistral antes de cambiar de modelo o de prompt |

## Validación de Datos

| Stack | Librería | Por qué |
|-------|----------|---------|
| Backend FastAPI | **Pydantic v2** | Validación nativa integrada en FastAPI; generación automática de OpenAPI schemas; motor Rust (v2) para máximo rendimiento |

## Herramientas de Calidad de Código

| Herramienta | Para qué |
|-------------|----------|
| Ruff | Linter ultrarrápido (Rust): reemplaza flake8 + isort + pyflakes en una sola herramienta |
| Black | Formateador PEP8 determinista — sin configuración de estilo manual |
| mypy strict | Type checking estático con plugin Pydantic — verifica todos los tipos en runtime |
| pre-commit hooks | Ejecuta Ruff + mypy + Black automáticamente antes de cada commit |
