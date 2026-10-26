# ⚡ FastAPI 0.110 — Setup completo con pip + venv

> **Stack:** FastAPI 0.110 · Python 3.11+ · Pydantic v2 · SQLAlchemy 2 async · PostgreSQL · Redis · Celery · spaCy · sentence-transformers · LangChain · FAISS · Ollama  
> **Arquitectura:** MVC + Hexagonal (Ports & Adapters) + Clean Architecture + async/await  
> **Nota:** FastAPI es un proyecto Python. En lugar de pnpm se usa `pip` con entorno virtual `venv`.
http://localhost:8000

uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
uvicorn app.main:app --reload
---

## 1. Crear el proyecto e inicializar entorno virtual

```bash
mkdir -p apps/ai-service && cd apps/ai-service

# Crear entorno virtual
python -m venv .venv

# Activar entorno (Git Bash en Windows)
source .venv/Scripts/activate

# Actualizar pip
pip install --upgrade pip
# or para windows
python -m pip install --upgrade pip
```

---

## 2. Instalar dependencias de producción

```bash
# ── Core FastAPI ──────────────────────────
pip install "fastapi==0.110.0" "uvicorn[standard]"

# ── Validación y configuración ────────────
pip install "pydantic[email]==2.*" pydantic-settings

# ── Base de datos async ───────────────────
pip install "sqlalchemy[asyncio]" asyncpg alembic

# ── Caché (Redis async) ───────────────────
pip install "redis[asyncio]"

# ── Cola de tareas ────────────────────────
pip install celery flower

# ── IA: NLP y similitud semántica ─────────
pip install sentence-transformers spacy scikit-learn

# ── IA: LLM local + RAG ───────────────────
pip install langchain langchain-community langchain-core
pip install faiss-cpu

# ── Seguridad: JWT ────────────────────────
pip install "python-jose[cryptography]" "passlib[bcrypt]"

# ── HTTP client async ─────────────────────
pip install httpx

# ── Guardar dependencias ──────────────────
pip freeze > requirements.txt
```

---

## 3. Instalar dependencias de desarrollo

```bash
# Testing
pip install pytest pytest-asyncio pytest-cov \
  httpx factory-boy faker locust

# Calidad de código
pip install ruff black mypy pre-commit

# Guardar dependencias de dev
pip freeze > requirements-dev.txt
```

---

## 4. Crear estructura de carpetas y archivos

> Ejecutar desde la raíz de `apps/ai-service/` en Git Bash.

```bash
# ════════════════════════════════════════════
# MÓDULO: grading — Calificación Automática
# ════════════════════════════════════════════

mkdir -p src/modules/grading/domain/entities \
  src/modules/grading/domain/interfaces \
  src/modules/grading/domain/value_objects \
  src/modules/grading/application/use_cases \
  src/modules/grading/application/schemas \
  src/modules/grading/infrastructure/repositories \
  src/modules/grading/infrastructure/models \
  src/modules/grading/presentation

# __init__.py por capa
touch src/__init__.py \
  src/modules/__init__.py \
  src/modules/grading/__init__.py \
  src/modules/grading/domain/__init__.py \
  src/modules/grading/application/__init__.py \
  src/modules/grading/infrastructure/__init__.py \
  src/modules/grading/presentation/__init__.py

# Domain — entidades
touch src/modules/grading/domain/entities/grading_result.py

# Domain — ports (interfaces)
touch src/modules/grading/domain/interfaces/grading_repository.py \
  src/modules/grading/domain/interfaces/grading_model.py

# Domain — value objects
touch src/modules/grading/domain/value_objects/score.py \
  src/modules/grading/domain/value_objects/confidence.py

# Application — use cases
touch src/modules/grading/application/use_cases/grade_answer.py \
  src/modules/grading/application/use_cases/batch_grade.py \
  src/modules/grading/application/use_cases/generate_rubric.py

# Application — schemas Pydantic v2
touch src/modules/grading/application/schemas/grading_request.py \
  src/modules/grading/application/schemas/grading_response.py

# Infrastructure — adapters concretos
touch src/modules/grading/infrastructure/repositories/grading_repo.py
touch src/modules/grading/infrastructure/models/exact_match_model.py \
  src/modules/grading/infrastructure/models/similarity_model.py \
  src/modules/grading/infrastructure/models/nlp_model.py \
  src/modules/grading/infrastructure/models/model_factory.py

# Presentation — FastAPI Router
touch src/modules/grading/presentation/grading_router.py

# ════════════════════════════════════════════
# MÓDULO: feedback — Feedback Pedagógico
# ════════════════════════════════════════════

mkdir -p src/modules/feedback/domain/entities \
  src/modules/feedback/domain/interfaces \
  src/modules/feedback/domain/value_objects \
  src/modules/feedback/application/use_cases \
  src/modules/feedback/application/schemas \
  src/modules/feedback/infrastructure/repositories \
  src/modules/feedback/infrastructure/clients \
  src/modules/feedback/presentation

touch src/modules/feedback/__init__.py \
  src/modules/feedback/domain/__init__.py \
  src/modules/feedback/application/__init__.py \
  src/modules/feedback/infrastructure/__init__.py \
  src/modules/feedback/presentation/__init__.py

# Domain
touch src/modules/feedback/domain/entities/feedback.py \
  src/modules/feedback/domain/entities/recommendation.py
touch src/modules/feedback/domain/interfaces/feedback_repository.py \
  src/modules/feedback/domain/interfaces/llm_client.py
touch src/modules/feedback/domain/value_objects/feedback_type.py

# Application
touch src/modules/feedback/application/use_cases/generate_feedback.py \
  src/modules/feedback/application/use_cases/generate_recommendation.py \
  src/modules/feedback/application/use_cases/analyze_weaknesses.py \
  src/modules/feedback/application/use_cases/generate_study_plan.py
touch src/modules/feedback/application/schemas/feedback_request.py \
  src/modules/feedback/application/schemas/feedback_response.py

# Infrastructure
touch src/modules/feedback/infrastructure/repositories/feedback_repo.py
touch src/modules/feedback/infrastructure/clients/ollama_client.py \
  src/modules/feedback/infrastructure/clients/rag_retriever.py

# Presentation
touch src/modules/feedback/presentation/feedback_router.py

# ════════════════════════════════════════════
# MÓDULO: assistant — Agente Tutor IA Conversacional
# ════════════════════════════════════════════

mkdir -p src/modules/assistant/domain/entities \
  src/modules/assistant/domain/interfaces \
  src/modules/assistant/domain/value_objects \
  src/modules/assistant/application/use_cases \
  src/modules/assistant/application/schemas \
  src/modules/assistant/infrastructure/agents \
  src/modules/assistant/infrastructure/vector_stores \
  src/modules/assistant/infrastructure/repositories \
  src/modules/assistant/presentation

touch src/modules/assistant/__init__.py \
  src/modules/assistant/domain/__init__.py \
  src/modules/assistant/application/__init__.py \
  src/modules/assistant/infrastructure/__init__.py \
  src/modules/assistant/presentation/__init__.py

# Domain
touch src/modules/assistant/domain/entities/conversation.py
touch src/modules/assistant/domain/interfaces/agent.py \
  src/modules/assistant/domain/interfaces/vector_store.py
touch src/modules/assistant/domain/value_objects/message.py

# Application
touch src/modules/assistant/application/use_cases/chat_with_agent.py \
  src/modules/assistant/application/use_cases/get_conversation.py
touch src/modules/assistant/application/schemas/chat_request.py \
  src/modules/assistant/application/schemas/chat_response.py

# Infrastructure — LangChain ReAct agent + FAISS + Redis
touch src/modules/assistant/infrastructure/agents/tutor_agent.py
touch src/modules/assistant/infrastructure/vector_stores/faiss_store.py
touch src/modules/assistant/infrastructure/repositories/conversation_repo.py

# Presentation
touch src/modules/assistant/presentation/assistant_router.py

# ════════════════════════════════════════════
# MÓDULO: analytics — Análisis y Métricas IA
# ════════════════════════════════════════════

mkdir -p src/modules/analytics/domain/entities \
  src/modules/analytics/domain/interfaces \
  src/modules/analytics/application/use_cases \
  src/modules/analytics/application/schemas \
  src/modules/analytics/infrastructure/models \
  src/modules/analytics/presentation

touch src/modules/analytics/__init__.py \
  src/modules/analytics/domain/__init__.py \
  src/modules/analytics/application/__init__.py \
  src/modules/analytics/infrastructure/__init__.py \
  src/modules/analytics/presentation/__init__.py

# Domain
touch src/modules/analytics/domain/entities/difficulty_label.py
touch src/modules/analytics/domain/interfaces/analytics_repository.py

# Application
touch src/modules/analytics/application/use_cases/classify_difficulty.py \
  src/modules/analytics/application/use_cases/detect_anomalies.py
touch src/modules/analytics/application/schemas/analytics_response.py

# Infrastructure — scikit-learn KMeans + IsolationForest
touch src/modules/analytics/infrastructure/models/classifier.py

# Presentation
touch src/modules/analytics/presentation/analytics_router.py

# ════════════════════════════════════════════
# shared/ — Cross-Cutting Concerns
# ════════════════════════════════════════════

mkdir -p src/shared/middleware \
  src/shared/dependencies \
  src/shared/exceptions \
  src/shared/config

touch src/shared/__init__.py

# Middleware — auth, logging, CORS
touch src/shared/middleware/auth_middleware.py \
  src/shared/middleware/logging_middleware.py \
  src/shared/middleware/cors_middleware.py

# Dependencies — Depends() factories
touch src/shared/dependencies/auth_deps.py \
  src/shared/dependencies/db_deps.py \
  src/shared/dependencies/model_deps.py

# Exception handlers
touch src/shared/exceptions/handlers.py \
  src/shared/exceptions/custom_errors.py

# Configuración (Pydantic BaseSettings)
touch src/shared/config/settings.py \
  src/shared/config/database.py

# Entrypoints
touch src/main.py src/routers.py

# ════════════════════════════════════════════
# tests/ — Suite de pruebas completa
# ════════════════════════════════════════════

mkdir -p tests/unit/use_cases/grading \
  tests/unit/use_cases/feedback \
  tests/unit/use_cases/assistant \
  tests/unit/schemas \
  tests/unit/value_objects \
  tests/unit/models \
  tests/integration/grading \
  tests/integration/feedback \
  tests/integration/assistant \
  tests/integration/analytics \
  tests/functional \
  tests/performance/scenarios \
  tests/usability

touch tests/__init__.py \
  tests/unit/__init__.py \
  tests/integration/__init__.py \
  tests/functional/__init__.py \
  tests/usability/__init__.py

# Unitarias — use_cases grading
touch tests/unit/use_cases/grading/test_grade_answer.py \
  tests/unit/use_cases/grading/test_batch_grade.py \
  tests/unit/use_cases/grading/test_generate_rubric.py

# Unitarias — use_cases feedback
touch tests/unit/use_cases/feedback/test_generate_feedback.py \
  tests/unit/use_cases/feedback/test_analyze_weaknesses.py \
  tests/unit/use_cases/feedback/test_generate_study_plan.py

# Unitarias — use_cases assistant
touch tests/unit/use_cases/assistant/test_chat_with_agent.py \
  tests/unit/use_cases/assistant/test_get_conversation.py

# Unitarias — schemas Pydantic
touch tests/unit/schemas/test_grading_schemas.py \
  tests/unit/schemas/test_feedback_schemas.py \
  tests/unit/schemas/test_chat_schemas.py

# Unitarias — value objects
touch tests/unit/value_objects/test_score.py \
  tests/unit/value_objects/test_confidence.py

# Unitarias — modelos IA
touch tests/unit/models/test_similarity_model.py \
  tests/unit/models/test_model_factory.py

# Integración (pytest + httpx TestClient)
touch tests/integration/grading/test_grading_router.py \
  tests/integration/grading/test_batch_grading.py
touch tests/integration/feedback/test_feedback_router.py \
  tests/integration/feedback/test_study_plan_router.py
touch tests/integration/assistant/test_assistant_router.py \
  tests/integration/assistant/test_conversation_state.py
touch tests/integration/analytics/test_analytics_router.py

# Funcionales E2E (pytest + httpx)
touch tests/functional/test_grading_flow.py \
  tests/functional/test_feedback_flow.py \
  tests/functional/test_assistant_flow.py \
  tests/functional/test_auth_protection.py \
  tests/functional/test_batch_flow.py

# Rendimiento — Locust
touch tests/performance/locustfile.py \
  tests/performance/locust.conf
touch tests/performance/scenarios/grading_load.py \
  tests/performance/scenarios/feedback_load.py \
  tests/performance/scenarios/assistant_load.py \
  tests/performance/scenarios/batch_throughput.py

# Usabilidad — contratos OpenAPI
touch tests/usability/test_openapi_contract.py \
  tests/usability/test_error_messages.py \
  tests/usability/test_response_consistency.py \
  tests/usability/test_docs_endpoint.py

# ════════════════════════════════════════════
# alembic/ — Migraciones de BD
# ════════════════════════════════════════════

mkdir -p alembic/versions
touch alembic/versions/001_initial_schema.py \
  alembic/env.py

# ════════════════════════════════════════════
# Archivos de configuración raíz
# ════════════════════════════════════════════

touch requirements.txt \
  requirements-dev.txt \
  pyproject.toml \
  pytest.ini \
  .env.example \
  Dockerfile
```

---

## 5. Configurar pyproject.toml (Ruff + Black + mypy)

```bash
cat > pyproject.toml << 'EOF'
[tool.ruff]
line-length = 88
select = ["E", "F", "I", "N", "W"]
ignore = ["E501"]

[tool.black]
line-length = 88
target-version = ["py311"]

[tool.mypy]
python_version = "3.11"
strict = true
plugins = ["pydantic.mypy"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=src --cov-report=html --cov-report=xml"
markers = [
  "unit: pruebas unitarias aisladas",
  "integration: pruebas con BD y Redis reales",
  "functional: flujos E2E completos",
  "performance: carga y rendimiento",
  "usability: contratos OpenAPI y UX de API"
]
EOF
```

---

## 6. Descargar modelo spaCy

```bash
python -m spacy download es_core_news_sm
python -m spacy download en_core_web_sm
```
