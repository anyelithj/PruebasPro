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

**Tecnologías:** FastAPI 0.128 · Pydantic v2 · SQLAlchemy 2 async · PostgreSQL · Redis · spaCy · sentence-transformers · LangChain · FAISS · Ollama (OllamaClient compartido; LLM propio en GGUF) · Hugging Face PEFT + TRL (QLoRA del LLM propio, fuera de línea) · pytest · Locust · Ruff · Black · mypy · MkDocs + mkdocstrings

---

## Estructura de Carpetas Completa

> Árbol generado desde la matriz `matriz_trazabilidad_tecnica_AulaDeIdiomas (6).xlsx` (hoja «🤖 FastAPI Python», columna «Carpeta / Archivo (FBA)»): ambos documentos listan los mismos archivos con los mismos nombres. La etiqueta `[CREAR | LISTAR | VER DETALLE | EDITAR | ELIMINAR]` indica qué operación CRUD atiende cada archivo; en la matriz no se repiten las carpetas porque ya aparecen en la ruta de cada archivo.

```
apps/ai-service/                                    # MVC: View=schemas+/docs · Controller=presentation/ · Model=domain/
├── data/
│   ├── faiss_index/
│   │   ├── knowledge.faiss
│   │   └── knowledge.json                          # Configuración
│   └── own_llm/
│       ├── heldout.jsonl
│       └── train.jsonl
├── src/                                            # Código fuente de la aplicación
│   ├── modules/                                    # Bounded Contexts IA
│   │   ├── alignment/
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── align_request.py            # Pydantic v2 (request/response)
│   │   │   │   │   └── align_response.py           # Pydantic v2 (request/response)
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── align_lines.py              # [CREAR] calcular inicio y fin de cada línea
│   │   │   │   └── __init__.py
│   │   │   ├── domain/                             # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── __init__.py
│   │   │   │   └── text_matching.py                # coincidencia aproximada entre las palabras transcritas y el texto
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── alignment_router.py             # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   │   │   └── __init__.py
│   │   ├── analytics/                              # Contexto: Análisis y Métricas IA
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   └── analytics_response.py       # Pydantic: question_id, new_label, confidence
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── classify_difficulty.py      # UC: clustering K-means sobre tasa de error real
│   │   │   │   │   └── detect_anomalies.py         # UC: preguntas con respuesta atípica (outliers)
│   │   │   │   └── __init__.py
│   │   │   ├── domain/
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   └── difficulty_label.py         # Entidad: question_id, original, computed, confidence
│   │   │   │   ├── interfaces/                     # Ports (DIP)
│   │   │   │   │   └── analytics_repository.py     # Interfaz de dominio (DIP) analytics repository py
│   │   │   │   └── __init__.py
│   │   │   ├── infrastructure/
│   │   │   │   ├── models/                         # Modelos
│   │   │   │   │   └── classifier.py               # Adapter: scikit-learn KMeans + IsolationForest
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── analytics_repository.py     # una fila por pregunta | `jsonb_array_elements` (PostgreSQL) recorre las respuestas de cada sesión | parámetro `:min` (si…
│   │   │   │   └── __init__.py
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── analytics_router.py             # GET /analytics/difficulty + /anomalies
│   │   │   └── __init__.py
│   │   ├── assistant/                              # Contexto: Agente Tutor IA Conversacional
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── chat_request.py             # Pydantic: message, session_id, persona y contexto (quiz, pantalla, juego o tema)
│   │   │   │   │   ├── chat_response.py            # Pydantic: reply, sources[], session_id
│   │   │   │   │   ├── conversation_response.py    # [VER DETALLE] [Sprint 11.2] Pydantic v2 de salida (response_model): historial de la sesión de chat (mensajes, contexto y user_id)
│   │   │   │   │   ├── faq_response.py             # [LISTAR] [Sprint 11.2] Pydantic v2 de salida (response_model): FAQ encontradas por similitud con su puntaje
│   │   │   │   │   ├── knowledge_response.py       # Schemas Pydantic v2 — respuestas de /assistant/knowledge* y /assistant/conversation/{id}
│   │   │   │   │   └── reindex_response.py         # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): secciones del manual indexadas en FAISS
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── chat_with_agent.py          # [CREAR] UC: turno conversación + RAG retrieval + LLM
│   │   │   │   │   ├── get_conversation.py         # [VER DETALLE] UC: historial de sesión de chat
│   │   │   │   │   ├── reindex_knowledge.py        # ReindexKnowledgeUseCase — reconstruye el índice del tutor desde los recursos aprobados (Sprint 5.3)
│   │   │   │   │   ├── reindex_manual.py           # [CREAR] divide el manual por sección y reconstruye el índice FAISS
│   │   │   │   │   ├── search_faq.py               # [LISTAR] búsqueda de FAQ por similitud (umbral)
│   │   │   │   │   └── upsert_faq_embeddings.py    # [CREAR] embeddings de las FAQ publicadas por NestJS
│   │   │   │   └── __init__.py
│   │   │   ├── domain/
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   └── conversation.py             # Entidad: session_id, messages[], context, user_id
│   │   │   │   ├── interfaces/                     # Ports (DIP)
│   │   │   │   │   ├── agent.py                    # Port (Protocol): interfaz agente IA (DIP)
│   │   │   │   │   ├── conversation_repository.py  # Puerto del almacén de conversaciones del asistente (personas con estado: guía, soporte, juego y apertura del avatar)
│   │   │   │   │   ├── game_engine.py              # GameEngine (motor determinista de un juego)
│   │   │   │   │   └── vector_store.py             # Port (Protocol): búsqueda vectorial
│   │   │   │   ├── value_objects/                  # Value Objects
│   │   │   │   │   ├── game_context.py             # contexto del juego: tipo, objetivo, prohibidas, turno y objetivos cumplidos
│   │   │   │   │   ├── language_usage.py           # fracción de palabras del alumno que deben ir en el idioma meta | `MappingProxyType` (stdlib): tabla de solo lectura
│   │   │   │   │   ├── message.py                  # VO: role (user|assistant) + content + timestamp
│   │   │   │   │   ├── persona.py                  # Persona: tutor | guide | game | dialogue
│   │   │   │   │   ├── pronunciation_query.py      # ¿El alumno pregunta cómo se pronuncia algo? → qué palabras (Tarea 9 · Pronunciación)
│   │   │   │   │   ├── screen_context.py           # contexto de pantalla del Agente Guía (ruta + rol + idioma)
│   │   │   │   │   └── topic_script.py             # apertura y objetivos de un tema de diálogo (determinista)
│   │   │   │   ├── __init__.py
│   │   │   │   └── knowledge_text.py               # `dict` inmutable por convención (constante de módulo)
│   │   │   ├── infrastructure/
│   │   │   │   ├── agents/                         # Agentes
│   │   │   │   │   ├── agent_factory.py            # elige el agente según la persona (Strategy)
│   │   │   │   │   ├── dialogue_agent.py           # persona de diálogo: tema, nivel e historial
│   │   │   │   │   ├── game_agent.py               # persona de juegos: delega en el motor del juego y usa el LLM solo para la jugada libre
│   │   │   │   │   ├── guide_agent.py              # persona guía: FAQ → manual (RAG) → LLM; cita la sección del manual
│   │   │   │   │   ├── guide_basics.py             # problema resuelto = agradecimiento
│   │   │   │   │   └── tutor_agent.py              # Impl LangChain ReAct agent con herramientas
│   │   │   │   ├── clients/
│   │   │   │   │   ├── faq_retriever.py            # FaqRetriever (FAISS + sentence-transformers)
│   │   │   │   │   └── manual_retriever.py         # ManualRetriever (RAG sobre el mismo FaissStore)
│   │   │   │   ├── games/                          # Motores de juego (Strategy)
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── chained_story_engine.py     # historia encadenada
│   │   │   │   │   ├── debate_engine.py            # debate rápido
│   │   │   │   │   ├── describe_guess_engine.py    # describe y adivina
│   │   │   │   │   ├── role_play_engine.py         # role-play con escenario y objetivos
│   │   │   │   │   ├── taboo_engine.py             # tabú y palabra prohibida
│   │   │   │   │   └── twenty_questions_engine.py  # 20 preguntas (respuestas sí/no deterministas)
│   │   │   │   ├── repositories/                   # Repositorios (implementan los ports)
│   │   │   │   │   ├── conversation_repository.py  # [CREAR, LISTAR, VER DETALLE] Impl Redis (sesiones TTL 24h)
│   │   │   │   │   └── knowledge_repository.py     # lo que no aparece (archived) nunca se indexa | `dict` = Lookup Table
│   │   │   │   ├── vector_stores/                  # Almacenes vectoriales
│   │   │   │   │   └── faiss_store.py              # Impl FAISS del port VectorStore
│   │   │   │   └── __init__.py
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── assistant_router.py             # [CREAR, LISTAR, VER DETALLE] POST /assistant/chat + GET /assistant/{session_id}
│   │   │   └── __init__.py
│   │   ├── feedback/                               # Contexto: Feedback Pedagógico
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── analyze_response.py         # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): conceptos débiles con su porcentaje de acierto
│   │   │   │   │   ├── feedback_request.py         # Pydantic: question, answer, history, user_level
│   │   │   │   │   ├── feedback_response.py        # Pydantic: feedback, recommendations[], study_plan
│   │   │   │   │   └── study_plan_response.py      # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): ruta de aprendizaje ordenada por prioridad
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── analyze_weaknesses.py       # [CREAR] UC: detectar conceptos con < 60% acierto
│   │   │   │   │   ├── generate_feedback.py        # [CREAR] UC: feedback inmediato por respuesta incorrecta
│   │   │   │   │   ├── generate_recommendation.py  # [CREAR] UC: plan de estudio personalizado
│   │   │   │   │   └── generate_study_plan.py      # [CREAR] UC: ruta de aprendizaje ordenada por prioridad
│   │   │   │   └── __init__.py
│   │   │   ├── domain/
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   ├── feedback.py                 # Entidad: texto, tipo, recursos, user_id, quiz_id · ⚠ archivo vacío (marcador)
│   │   │   │   │   └── recommendation.py           # Entidad: temas, prioridad, recursos_url, plan · ⚠ archivo vacío (marcador)
│   │   │   │   ├── interfaces/                     # Ports (DIP)
│   │   │   │   │   ├── feedback_repository.py      # [CREAR, VER DETALLE] Port (Protocol) · ⚠ archivo vacío (marcador)
│   │   │   │   │   └── llm_client.py               # Port (Protocol): generar texto con LLM (DIP)
│   │   │   │   ├── value_objects/                  # Value Objects
│   │   │   │   │   └── feedback_type.py            # VO: CORRECTION | HINT | EXPLANATION | MOTIVATION
│   │   │   │   └── __init__.py
│   │   │   ├── infrastructure/
│   │   │   │   ├── clients/                        # Clientes externos (Adapter)
│   │   │   │   │   ├── ollama_client.py            # Adapter: Ollama LLM local; único cliente de Ollama del servicio de IA (lo reutilizan Assistant, Grading, LanguageTools y LevelClassifier mediante LlmPort)
│   │   │   │   │   └── rag_retriever.py            # Adapter: FAISS vector search para contexto RAG
│   │   │   │   ├── repositories/                   # Repositorios (implementan los ports)
│   │   │   │   │   └── feedback_repository.py      # [CREAR, VER DETALLE] Impl SQLAlchemy async · ⚠ archivo vacío (marcador)
│   │   │   │   └── __init__.py
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── feedback_router.py              # [CREAR, VER DETALLE] POST /feedback/generate + /analyze + /study-plan
│   │   │   └── __init__.py
│   │   ├── grading/                                # Contexto: Calificación Automática
│   │   │   ├── application/                        # Capa Aplicación — casos de uso (SRP)
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── batch_response.py           # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): 202 con job_id y resultados de la calificación en lote
│   │   │   │   │   ├── evaluate_request.py         # Pydantic v2: ítem de práctica, respuesta y tipo de ejercicio
│   │   │   │   │   ├── evaluate_response.py        # Pydantic v2: hallazgos, respuesta correcta y consejo
│   │   │   │   │   ├── grading_request.py          # Pydantic v2: answer, question, type, language
│   │   │   │   │   └── grading_response.py         # Pydantic v2: score, confidence, explanation
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── batch_grade.py              # [CREAR] UC: calificar N respuestas en paralelo (asyncio.gather)
│   │   │   │   │   ├── evaluate_attempt.py         # [CREAR] evaluar la respuesta de práctica y clasificar los errores
│   │   │   │   │   ├── generate_rubric.py          # [CREAR] ⚠ archivo vacío (marcador): se elimina; las rúbricas las genera NestJS Curriculum
│   │   │   │   │   └── grade_answer.py             # [CREAR] UC: elegir Strategy + calificar + retornar Score
│   │   │   │   └── __init__.py
│   │   │   ├── domain/                             # Capa Dominio — sin imports externos (DIP)
│   │   │   │   ├── entities/                       # Entidades de dominio
│   │   │   │   │   └── grading_result.py           # Entidad: score, confidence, method, question_id
│   │   │   │   ├── interfaces/                     # Ports (DIP)
│   │   │   │   │   ├── grading_model.py            # Port (Protocol): interfaz modelo IA (DIP)
│   │   │   │   │   └── grading_repository.py       # [CREAR, VER DETALLE] Port (Protocol): persistir + consultar resultados · ⚠ archivo vacío (marcador)
│   │   │   │   ├── value_objects/                  # Value Objects
│   │   │   │   │   ├── confidence.py               # VO: HIGH | MEDIUM | LOW basado en threshold
│   │   │   │   │   └── score.py                    # VO: float 0.0-1.0 con validación inmutable
│   │   │   │   └── __init__.py
│   │   │   ├── infrastructure/                     # Capa Infraestructura — Adapters concretos
│   │   │   │   ├── evaluators/                     # Evaluadores de práctica (Strategy por tipo de ejercicio)
│   │   │   │   │   ├── __init__.py
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
│   │   │   │   ├── repositories/                   # Repositorios (implementan los ports)
│   │   │   │   │   └── grading_repository.py       # [CREAR, VER DETALLE] Impl SQLAlchemy async del port grading_repository · ⚠ archivo vacío (marcador)
│   │   │   │   └── __init__.py
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── grading_router.py               # [CREAR, VER DETALLE] FastAPI Router: POST /grading/grade + /batch + /practice
│   │   │   └── __init__.py
│   │   ├── language_tools/
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── catalog_response.py         # Schemas Pydantic v2 — respuestas de GET /language-tools/languages y /accents
│   │   │   │   │   ├── detect_request.py           # Schemas Pydantic v2 — POST /language-tools/detect (idioma de un texto, sin LLM)
│   │   │   │   │   ├── ipa_request.py              # Pydantic v2 (request/response)
│   │   │   │   │   ├── ipa_response.py             # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): IPA UK y US por palabra y completa
│   │   │   │   │   ├── lines_request.py            # Pydantic v2 (request/response)
│   │   │   │   │   ├── lines_response.py           # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): líneas con traducción e IPA
│   │   │   │   │   ├── lookup_response.py          # [VER DETALLE] Pydantic v2 (request/response)
│   │   │   │   │   ├── speak_request.py            # [CREAR] Pydantic v2: texto, idioma y variante BCP-47
│   │   │   │   │   ├── translate_request.py        # Pydantic v2 (request/response)
│   │   │   │   │   ├── translate_response.py       # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): traducción y alternativas
│   │   │   │   │   ├── word_request.py             # Pydantic v2 (request/response)
│   │   │   │   │   └── word_response.py            # [VER DETALLE] [Sprint 11.2] Pydantic v2 de salida (response_model): palabra según su frase, IPA y ejemplos breves
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── enrich_lines.py             # [CREAR] traducir y transcribir a IPA cada línea de una letra o de un diálogo
│   │   │   │   │   ├── lookup_term.py              # [CREAR] orquestar traducción e IPA en paralelo
│   │   │   │   │   ├── lookup_word.py              # [CREAR] traducir una palabra según su frase, transcribirla y dar ejemplos breves
│   │   │   │   │   ├── noun_grammar.py             # con el prompt completo el modelo de CPU escribía pinyin/casos para TODOS los idiomas (~70 tokens por término:
│   │   │   │   │   ├── synthesize_speech.py        # [CREAR] voz de la variante → WAV (POST /language-tools/speak)
│   │   │   │   │   ├── transcribe_ipa.py           # [CREAR] transcribir a IPA por palabra y completa
│   │   │   │   │   └── translate_text.py           # [CREAR] traducir un término o una frase
│   │   │   │   └── __init__.py
│   │   │   ├── domain/                             # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── llm_client.py               # LlmPort (se reutiliza el cliente de Ollama)
│   │   │   │   │   ├── phonetizer.py               # Phonetizer
│   │   │   │   │   ├── speech_synthesizer.py       # SpeechSynthesizer (texto + voz → WAV) y SpeechUnavailableError 503
│   │   │   │   │   └── translation_cache.py        # Puerto de la caché de traducciones validadas
│   │   │   │   ├── __init__.py
│   │   │   │   ├── audio_quality.py                # -60 dBFS (0,001 de la escala completa) — por debajo, el oído no percibe nada con el volumen normal del sistema
│   │   │   │   ├── language_voices.py              # idioma → voz de espeak-ng (en-gb y en-us, fr-fr, de, es, pt-br y pt-pt, cmn, ru)
│   │   │   │   ├── noun_grammar.py                 # Gramática obligatoria de los sustantivos del vocabulario (regla 2026-11-03)
│   │   │   │   └── translation_rules.py            # «yes/no/ok…» por idioma de origen → español | modelos de 3–8B las devuelven sin traducir («yes» → «yes»)
│   │   │   ├── infrastructure/
│   │   │   │   ├── clients/                        # Clientes externos (Adapter)
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── espeak_phonetizer.py        # EspeakPhonetizer (ejecuta el binario espeak-ng; no usa el LLM)
│   │   │   │   │   └── espeak_speech.py            # espeak-ng local (texto por stdin, sin shell; funciona con cualquier event loop)
│   │   │   │   ├── __init__.py
│   │   │   │   └── translation_cache.py            # Caché en memoria de traducciones validadas (frases repetidas en diálogos y canciones → sin otra llamada al LLM)
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── language_tools_router.py        # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   │   │   └── __init__.py
│   │   ├── level_classifier/
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── classify_request.py         # Pydantic v2 (request/response)
│   │   │   │   │   ├── classify_response.py        # Pydantic v2 (request/response)
│   │   │   │   │   └── criteria_response.py        # Schema Pydantic v2 — respuesta de GET /level-classifier/criteria
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── classify_text.py            # [CREAR] estimar el nivel CEFR de un texto o diálogo
│   │   │   │   └── __init__.py
│   │   │   ├── domain/
│   │   │   │   ├── value_objects/                  # Value Objects
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── estimated_level.py          # nivel estimado (nivel, confianza e indicadores)
│   │   │   │   └── __init__.py
│   │   │   ├── infrastructure/
│   │   │   │   ├── clients/                        # Clientes externos (Adapter)
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── cefr_rubric_judge.py        # juicio con rúbrica CEFR mediante el LLM local
│   │   │   │   ├── measures/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── text_measures.py            # longitud media de oración y de palabra, riqueza léxica y proporción de palabras poco frecuentes
│   │   │   │   └── __init__.py
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── level_classifier_router.py      # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   │   │   └── __init__.py
│   │   ├── own_llm/                                # LLM propio: corrector pedagógico de redacciones (RF-144)
│   │   │   ├── application/
│   │   │   │   ├── schemas/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── corrector_io.py             # fragmentos de material revisado recuperados por el RAG (opcional, máximo 5); vacío = el modelo no recibe el campo
│   │   │   │   │   ├── model_card_response.py      # [VER DETALLE] [Sprint 11.2] Pydantic v2 de salida (response_model): versión, cuantización y métricas del modelo publicado
│   │   │   │   │   ├── scope_response.py           # [VER DETALLE] [Sprint 11.2] Pydantic v2 de salida (response_model): idiomas, niveles y tarea que cubre el LLM propio
│   │   │   │   │   ├── writing_request.py          # Pydantic v2: texto, idioma y nivel CEFR (7 idiomas · A1–C2; modelo propio solo en inglés, el resto va al modelo base)
│   │   │   │   │   └── writing_response.py         # Pydantic v2: errores marcados (ErrorFinding), corrección y explicación en español
│   │   │   │   ├── use_cases/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── correct_sentence.py         # Caso de uso: corrector pedagógico ÚNICO (Anexo A) — un JSON para el feedback previo al envío, la puntuación y el avatar
│   │   │   │   │   ├── correct_writing.py          # [CREAR] corrige con el LLM propio; si falla, usa el modelo base
│   │   │   │   │   └── get_model_card.py           # [VER DETALLE] versión, cuantización y métricas de evaluación del modelo publicado
│   │   │   │   └── __init__.py
│   │   │   ├── domain/
│   │   │   │   ├── rules/
│   │   │   │   │   ├── __init__.py                 # reglas PROPIAS de cada idioma (las comunes se aplican a todos) | francés, alemán, portugués, ruso y chino → solo comunes…
│   │   │   │   │   ├── common.py                   # palabra en cualquier alfabeto (latino con tildes, cirílico, CJK) + contracción con apóstrofo | `[^\W\d_]` = letra Unicod…
│   │   │   │   │   ├── context.py                  # Contexto de las reglas deterministas: idioma, pregunta previa y origen (voz o escrito)
│   │   │   │   │   ├── english.py                  # excepciones a la regla de la letra | ponytail: listas cerradas de palabras A1–B2; ampliar con los docentes
│   │   │   │   │   ├── places.py                   # forma correcta del país en cada idioma (países frecuentes en la plataforma) | ponytail: lista corta A1–B1; ampliar con l…
│   │   │   │   │   └── spanish.py                  # Reglas deterministas del español: signos de apertura ¿ y ¡ (Anexo A, regla 7)
│   │   │   │   ├── __init__.py
│   │   │   │   ├── correction_diff.py              # palabras (con apóstrofo o guion internos: «don't», «well-known») o un signo suelto; los espacios no cuentan
│   │   │   │   ├── verdict.py                      # Veredicto, puntuación y categorías del Anexo A a partir de los hallazgos ubicados (funciones puras)
│   │   │   │   └── writing_finding.py              # lo que los modelos pequeños escriben a veces en `type` → categoría canónica
│   │   │   ├── infrastructure/
│   │   │   │   ├── models/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── writing_corrector_model.py  # aula-corrector en Ollama mediante el OllamaClient compartido; respaldo al modelo base
│   │   │   │   └── __init__.py
│   │   │   ├── presentation/
│   │   │   │   ├── __init__.py
│   │   │   │   └── own_llm_router.py               # [CREAR, LISTAR, VER DETALLE] POST /own-llm/correct + GET /own-llm/scope + /own-llm/model
│   │   │   ├── prompts/
│   │   │   │   ├── __init__.py                     # Prompts versionados del LLM propio (RF-144 · RNF-35)
│   │   │   │   └── corrector_system.md             # Documentación
│   │   │   └── __init__.py
│   │   ├── speech/
│   │   │   ├── application/
│   │   │   │   ├── schemas/                        # Esquemas Pydantic v2
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── engine_response.py          # Schemas Pydantic v2 — respuestas de GET /speech/models y GET /speech/status
│   │   │   │   │   ├── fluency_request.py          # Pydantic v2 (request/response)
│   │   │   │   │   ├── fluency_response.py         # [CREAR] [Sprint 11.2] Pydantic v2 de salida (response_model): latencia, pausas, palabras por minuto y vocabulario reutilizado
│   │   │   │   │   └── transcribe_response.py      # Pydantic v2 (request/response)
│   │   │   │   ├── use_cases/                      # Casos de uso
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── analyze_fluency.py          # [CREAR] calcular métricas de fluidez
│   │   │   │   │   └── transcribe_audio.py         # [CREAR] transcribir audio con marcas de tiempo por palabra
│   │   │   │   └── __init__.py
│   │   │   ├── domain/                             # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── speech_to_text.py           # SpeechToText
│   │   │   │   ├── __init__.py
│   │   │   │   └── fluency_metrics.py              # latencia, pausas, palabras por minuto y vocabulario reutilizado
│   │   │   ├── presentation/                       # Capa Presentación — entrada HTTP
│   │   │   │   ├── __init__.py
│   │   │   │   └── speech_router.py                # [CREAR, LISTAR] Endpoints FastAPI (APIRouter)
│   │   │   └── __init__.py
│   │   └── __init__.py
│   ├── shared/                                     # Cross-Cutting Concerns
│   │   ├── clients/                                # Clientes compartidos (Adapter)
│   │   │   ├── __init__.py
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
│   │   │   ├── __init__.py
│   │   │   ├── error_finding.py                    # hallazgo (tipo, posición, corrección y explicación); lo usan Grading y OwnLlm (DRY)
│   │   │   ├── language_detect.py                  # `\u0400-\u04FF` (Unicode Cyrillic) · `\u4E00-\u9FFF` (CJK Unified Ideographs) → sin ambigüedad entre los 7 idiomas
│   │   │   ├── llm_output.py                       # Limpieza de la salida de modelos pequeños (qwen2.5:3b, aya-expanse:8b): JSON tolerante y traducciones «desenvueltas»
│   │   │   └── text_norm.py                        # normalizar texto y partir en palabras (DRY entre juegos y práctica)
│   │   ├── exceptions/                             # Excepciones
│   │   │   ├── custom_errors.py                    # Tipos error dominio IA: ModelError, GradingError
│   │   │   └── handlers.py                         # Global exception_handlers: HTTPException, ValueError
│   │   ├── middleware/                             # Middleware
│   │   │   ├── auth_middleware.py                  # JWT decode + inject current_user en request state
│   │   │   ├── cors_middleware.py                  # CORS config: origins, methods, credentials
│   │   │   └── logging_middleware.py               # Request/response logging con duración ms
│   │   ├── openapi/                                # [Sprint 11.2] OpenAPI de la API
│   │   │   └── openapi_config.py                   # título, descripción, tags_metadata por módulo, servers y esquema de seguridad bearer de /docs, /redoc y /openapi.json
│   │   ├── schemas/                                # [Sprint 11.2] Esquemas Pydantic compartidos
│   │   │   ├── error_response.py                   # ErrorResponse: formato unificado de errores (message en español, code y detail); lo escriben los handlers
│   │   │   └── responses.py                        # COMMON_RESPONSES: 401, 403, 422 y 500 con ErrorResponse; se pasa a responses= en los 9 routers (DRY)
│   │   └── __init__.py
│   ├── __init__.py
│   ├── main.py                                     # FastAPI app: lifespan + routers + middleware + OpenAPI · silencia los registros de httpx, huggingface_hub y faiss.loader
│   └── routers.py                                  # APIRouter: incluye todos los routers de módulos
├── alembic/                                        # Migraciones de BD versionadas
│   ├── versions/
│   │   └── 001_initial_schema.py                   # Tablas: grading_results, feedback, conversations
│   └── env.py                                      # Config alembic con SQLAlchemy async
├── tests/                                          # ══ PRUEBAS ══════════════════════════════
│   ├── evaluation/                                 # Evaluación de calidad (conjunto de referencia y conjunto reservado)
│   │   ├── __init__.py
│   │   ├── corrector_eval.jsonl
│   │   ├── retrieval_cases.py                      # Casos fijos de recuperación del RAG (Tarea 9 · RF-57): corpus PROPIO (redactado para el proyecto, sin texto de terceros)…
│   │   └── run_eval.py                             # JSON válido ≥ 98 %, mejora vs. modelo base, docentes ≥ 4/5 y latencia RNF-03; compara también Aya, Qwen y Mistral
│   ├── functional/                                 # FUNCIONALES (E2E) — pytest + httpx
│   │   ├── __init__.py
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
│   │   ├── grading/
│   │   │   ├── test_batch_grading.py               # POST /grading/batch → 202 + job_id + resultado en Redis
│   │   │   └── test_grading_router.py              # [CREAR, VER DETALLE] POST /grading/grade → 200 + score válido + persistido en BD
│   │   └── __init__.py
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
│   │   ├── openapi/                                        # [Sprint 11.2] OpenAPI
│   │   │   └── test_openapi_config.py                      # tags_metadata cubre los 9 módulos y el esquema bearer está declarado
│   │   ├── schemas/
│   │   │   ├── test_chat_schemas.py                # session_id UUID válido obligatorio
│   │   │   ├── test_error_response.py              # [Sprint 11.2] ErrorResponse exige message y code; los handlers devuelven ese formato
│   │   │   ├── test_feedback_schemas.py            # ValidationError si history no es lista
│   │   │   └── test_grading_schemas.py             # ValidationError si answer vacío o score fuera de rango
│   │   ├── use_cases/
│   │   │   ├── alignment/
│   │   │   │   └── test_align_lines.py             # [CREAR] tiempos por línea desde las marcas de palabra y propuesta con confianza en canciones
│   │   │   ├── analytics/
│   │   │   │   ├── __init__.py
│   │   │   │   └── test_analytics.py               # 3 grupos claros (fácil/medio/difícil) + una pregunta «fácil» que en realidad falla casi todo el mundo
│   │   │   ├── assistant/
│   │   │   │   ├── test_chat_with_agent.py         # [CREAR] RAG mockeado + LLM mockeado → respuesta con sources
│   │   │   │   ├── test_conversation_repository.py  # [Tarea 1 · RNF-06]: conversación en Redis (con TTL) sin perder datos al serializar; respaldo en memoria si Redis no resp…
│   │   │   │   ├── test_dialogue_agent.py          # [CREAR] apertura determinista por tema, respuesta dentro del tema y del nivel y corrección suave
│   │   │   │   ├── test_game_agent.py              # [CREAR] motores deterministas de los seis juegos y respaldo cuando el LLM no responde
│   │   │   │   ├── test_guide_agent.py             # [CREAR] Agente Guía: FAQ sin LLM → manual con citas y rol → «no lo sé»
│   │   │   │   ├── test_get_conversation.py        # [VER DETALLE] Redis mockeado retorna historial correcto
│   │   │   │   ├── test_language_usage.py          # «el presente simple» → explicación en español sin decir nunca cuándo pasar al inglés
│   │   │   │   ├── test_rag.py                     # «hola» traía vocabulario al azar y el tutor hablaba de «los ejemplos que te di»
│   │   │   │   ├── test_rag_retrieval.py           # Tarea 9 · RF-57: sincronización por recurso (sin huérfanos), filtros, búsqueda híbrida, fragmentación, estados y casos f…
│   │   │   │   ├── test_tutor_pronunciation.py     # Tarea 9 · Pronunciación: el tutor consulta el diccionario fonético directamente (no el RAG) y entrega la IPA exacta al m…
│   │   │   │   └── test_tutor_reply_cleanup.py     # «(Mejor así: "<la misma frase>")» confundía; despedirse corta el reto
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
│   │   │   │   ├── __init__.py
│   │   │   │   ├── test_enrich_lines.py            # con más de 40 líneas no se usaba el lote (80 llamadas al LLM → timeout en NestJS)
│   │   │   │   ├── test_language_detect.py         # empates y frases cortas de principiante ya no caen en el idioma por defecto
│   │   │   │   ├── test_lookup.py                  # [CREAR] traducción con LLM falso + IPA real de espeak-ng UK/US en paralelo
│   │   │   │   ├── test_noun_grammar.py            # lote → una sola llamada al LLM; cada término normalizado (artículo por género, plural) y los que falten sin marcar como …
│   │   │   │   ├── test_synthesize_speech.py       # [CREAR] voces, caso de uso y espeak-ng real en los 7 idiomas
│   │   │   │   ├── test_translation_kinds.py       # Paso 4 · Traducción (Caso C): tipo_de_texto (frase/título/expresión), glosario curado en 7 idiomas, signos ¿¡ completos,
│   │   │   │   └── test_translation_quality.py     # Pruebas 2026-10-25 · traducciones de «Temas de conversación» y «Biblioteca de diálogos» con las cadenas EXACTAS del repo…
│   │   │   ├── level_classifier/
│   │   │   │   └── test_classify_text.py           # [CREAR] indicadores medidos primero y rúbrica del LLM solo en casos dudosos
│   │   │   ├── speech/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── test_speech.py                  # [CREAR] faster-whisper transcribe audio real de espeak y métricas de fluidez puras
│   │   │   │   └── test_speech_engine_missing.py   # Tests 2026-10-25: faster-whisper ausente → 503 SPEECH_ENGINE_MISSING (no MODEL_INFERENCE_ERROR), WARNING una sola vez y …
│   │   │   ├── own_llm/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── test_correct_writing.py         # [CREAR] cadena de respaldo, contrato JSON, ubicación de errores y umbrales de run_eval
│   │   │   │   ├── test_correction_diff.py         # Tests 2026-10-27: corrector estilo GrammarMama — hallazgos por diff (difflib), merge con los del LLM y «Detectar idioma»
│   │   │   │   ├── test_corrector_annex_a.py       # Corrector pedagógico único (Anexo A): Caso A, validación Pydantic, reintento → modelo base → reglas, veredicto y puntuac…
│   │   │   │   ├── test_corrector_references.py    # Tarea 6/9 · Anexo A regla 11: el corrector con y sin «referencias» sigue devolviendo JSON válido del Anexo A y deja traz…
│   │   │   │   └── test_rules.py                   # Pruebas de las reglas deterministas del corrector (paso 2 · deterministic-first · 7 idiomas)
│   │   │   └── test_lookup_word_guard.py           # [Fix 2026-10-30]: la tarjeta de palabra muestra el significado de la PALABRA, nunca la frase traducida
│   │   ├── value_objects/
│   │   │   ├── test_confidence.py                  # Threshold correcto para HIGH/MEDIUM/LOW
│   │   │   └── test_score.py                       # Score(1.1) lanza ValueError, Score(0.0) válido
│   │   ├── __init__.py
│   │   ├── test_natural_age.py                     # Prueba
│   │   ├── test_run_eval_metrics.py                # Tarea 6 · RF-144: métricas separadas del comparativo (run_eval.py) y regla «un cambio solo se acepta si no empeora». Fun…
│   │   └── test_says_goodbye.py                    # Prueba
│   ├── usability/                                  # USABILIDAD API — pytest + httpx
│   │   ├── __init__.py
│   │   ├── test_docs_endpoint.py                   # [Sprint 11.2] /docs, /redoc y /openapi.json: 200 fuera de prod · 404 en producción
│   │   ├── test_error_messages.py                  # 400/401/422/500 tienen message descriptivo en español
│   │   ├── test_openapi_contract.py                # [Sprint 11.2] Todos los endpoints con tag, operationId único, respuesta 2xx y body con schema
│   │   ├── test_response_consistency.py            # Todas las respuestas siguen schema Pydantic declarado
│   │   └── test_response_schemas.py                # [Sprint 11.2] Toda operación 2xx declara response_model (cierra las 3 de 42 sin esquema de respuesta)
│   ├── __init__.py
│   └── conftest.py                                 # Fixtures compartidas de pytest (cliente y BD de prueba)
├── training/                                       # Ajuste fino fuera de línea (no se despliega con el servicio)
│   ├── writing_corrector/
│   │   ├── __init__.py
│   │   ├── annex_a.py                              # Datos de entrenamiento QLoRA del corrector del Anexo A (2026-11-13 · Tarea 6 · RF-144): {entrada} -> {salida JSON}
│   │   ├── COLAB.md                                # Documentación
│   │   ├── export_gguf.py                          # fusiona el adaptador y exporta a GGUF cuantizado
│   │   ├── Modelfile                               # registra el GGUF en Ollama (OLLAMA_CORRECTOR_MODEL)
│   │   ├── prepare_dataset.py                      # correcciones revisadas por docentes + sintéticos revisados; separa el conjunto reservado
│   │   └── train_qlora.py                          # QLoRA con Hugging Face PEFT y TRL sobre el modelo base
│   └── __init__.py
├── docs/                                           # [Sprint 11.2] Documentación de código del servicio (se publica en el sitio MkDocs único del repositorio)
│   ├── index.md                                    # Qué hace cada módulo de IA y cómo se conecta con NestJS
│   └── reference.md                                # ::: src.modules (mkdocstrings): referencia generada desde los docstrings
├── openapi/                                        # [Sprint 11.2] OpenAPI exportado (artefacto generado, no se edita a mano)
│   └── openapi.json                                # OpenAPI 3 de FastAPI (python scripts/export_openapi.py): entrada de packages/api-client y del visor único
├── scripts/                                        # [Sprint 11.2] Utilidades de desarrollo
│   ├── check_ai_deps.py                            # Comprueba las dependencias nativas del ai-service (voz a texto) en el venv ACTIVO
│   ├── export_openapi.py                           # exporta app.openapi() sin arrancar el servidor ni la BD para regenerar el cliente de API
│   ├── gen_guide_basics_ts.py                      # GENERADO por ai-service/scripts/gen_guide_basics_ts.py desde agents/guide_basics.py — no editar a mano
│   └── reindex_knowledge.py                        # Comando «reindexar todo» del RAG del temario (Tarea 9 · RF-57): reconstruye el índice FAISS desde la BD
├── .coverage                                       # Configuración
├── .dockerignore                                   # fuera del contexto de build lo que no va en la imagen
├── .env.example                                    # DB_URL, REDIS_URL, OLLAMA_URL, OLLAMA_MODEL, OLLAMA_CORRECTOR_MODEL, JWT_SECRET, NEST_URL
├── .gitignore                                      # artefactos del ajuste fino (GB) → no se versionan
├── Dockerfile                                      # Multi-stage: builder + runner (imagen mínima)
├── pyproject.toml                                  # Ruff + black + mypy + pytest markers config
├── pytest.ini                                      # asyncio_mode=auto + coverage + markers definidos
├── README.md                                       # Documentación
├── requirements-dev.txt                            # Testing: pytest, httpx, factory-boy, faker, locust, mkdocs, mkdocstrings[python]
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
| MkDocs + mkdocstrings | Documentación de código Python generada de los docstrings (`docs/reference.md`), publicada en el mismo sitio que TypeDoc y el visor de OpenAPI |
