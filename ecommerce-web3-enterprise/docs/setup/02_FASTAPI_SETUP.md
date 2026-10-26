# 🤖 Backend FastAPI (Python) — Guía de Creación desde Cero (Git Bash)

> Proyecto: **ecommerce-fastapi** · Basado en `02_FASTAPI.md`, `ecommerce_matriz_trazabilidad_v34.xlsx` (hoja "🤖 FastAPI Python") y `ESPECIFICACION_TECNICA_UNIFICADA.md`.

⚠️ **Nota importante:** FastAPI es Python, no Node.js. **pnpm no gestiona paquetes de Python.** Este archivo usa `python -m venv` + `pip` (el equivalente real en el ecosistema Python), ejecutado igualmente desde Git Bash. Si prefieres `poetry` o `uv` en vez de `pip`, dímelo y te doy la variante.

---

## 0. Prerrequisitos (Git Bash)

```bash
python --version   # Python 3.11+
pip --version
docker -v           # PostgreSQL con pgvector
```

---

## 1. Crear el proyecto desde cero

```bash
mkdir ecommerce-fastapi && cd ecommerce-fastapi
python -m venv .venv
source .venv/Scripts/activate   # Git Bash en Windows
python -m pip install --upgrade pip
```

---

## 2. Instalar dependencias (pip)

Agrupadas exactamente por lo que exige la matriz. Sin duplicados de propósito (un solo framework ASGI, un solo ORM async, un solo validador).

### 2.1 Núcleo del framework

```bash
pip install fastapi "uvicorn[standard]" pydantic pydantic-settings python-dotenv python-multipart
```

### 2.2 Base de datos — SQLAlchemy async + PostgreSQL + Alembic

```bash
pip install "sqlalchemy[asyncio]" asyncpg alembic
```

### 2.3 API GraphQL

```bash
pip install strawberry-graphql[fastapi]
```

### 2.4 Ciencia de datos base (usada por todos los módulos ML)

```bash
pip install pandas numpy
```

### 2.5 Forecasting / series de tiempo (demanda, tendencias)

```bash
pip install prophet statsmodels
```

### 2.6 Machine Learning clásico (fraude, churn, pricing, segmentación)

```bash
pip install scikit-learn xgboost
```

### 2.7 Deep Learning — solo TensorFlow 🔄

```bash
pip install "tensorflow>=2.16" keras-hub
```

> 🔄 **v35 — un solo framework de deep learning (decisión del responsable del proyecto):** se eligió **TensorFlow** y se quitó PyTorch (`torch`, `torchvision`). Consecuencias:
> - **Modelos preentrenados** (BERT, RoBERTa, CLIP, ResNet): **KerasHub** (Apache 2.0, de Google, sobre Keras 3). Reemplaza a `transformers`, que desde la v5 ya no soporta TensorFlow.
> - **Recomendador:** modelo two-tower (recuperación + ranking) con capas de Keras. Se quitó `tensorflow-recommenders`: está en mantenimiento y declara `tensorflow-macos`, que rompe el resolvedor de Poetry.
> - **Preprocesamiento de imágenes:** `tf.image` + Pillow (en lugar de torchvision).

### 2.8 Visión por computador (CLIP, ResNet, búsqueda visual)

```bash
pip install opencv-python pillow
```

### 2.9 NLP / Chatbot (BERT, spaCy, LangChain + Ollama local)

```bash
pip install spacy nltk langchain ollama     # BERT/RoBERTa vienen de keras-hub (2.7)
python -m spacy download es_core_news_sm
```

> 🔄 **Rasa eliminado (v35):** no aparece en `02_FASTAPI.md` ni en la matriz, y no es instalable en Python ≥ 3.11 (el proyecto usa 3.11+; sus dependencias fijan versiones antiguas de TensorFlow y `pip install rasa` falla, como ocurrió con Python 3.13). `apps/ecommerce-fastapi/pyproject.toml` ya lo omite. La detección de intenciones y el chatbot se resuelven con **LangChain + Ollama** (open source, local, sin costo por token), que ya estaban documentados. Si se necesitara Rasa, exigiría un entorno aparte con Python 3.10.

### 2.9.1 LLM Assistant (API LLM propia — RAG + Tool Use) — adición

> Reutiliza lo ya instalado en 2.9 (`langchain`, `ollama`), 2.11 (`faiss-cpu`, como fallback), 2.12 (`mlflow`, `celery`, `redis`) y 2.14 (`httpx`, que aquí pasa a usarse también en tiempo de ejecución por `tool_executor.py`). El streaming SSE usa `StreamingResponse` de FastAPI: no requiere paquete extra.

```bash
# Modelos locales (Ollama) — sin costo recurrente
ollama pull llama3
ollama pull nomic-embed-text      # embeddings para el índice RAG
```

✅ **pgvector** — registrado en la matriz (hoja FastAPI, LLM Assistant), en el Plan 5B.2 (se agrega a `pyproject.toml` con `poetry add pgvector` al iniciar la Fase 5B). Claude API / Anthropic SDK se retiró (solo Ollama local, 0 USD; Cambios v35 #46 y #56):

```bash
pip install pgvector             # cliente Python de pgvector (RAG sobre PostgreSQL)
```

> `pgvector` debe estar habilitado también en PostgreSQL (`CREATE EXTENSION vector;`). Si prefieres no agregar dependencias, `rag_retriever.py` puede arrancar solo con `faiss-cpu` (ya registrado).


### 2.10 Precios dinámicos — bandido contextual 🔄

Sin instalación: se implementa con **NumPy** (Thompson Sampling / LinUCB), el enfoque estándar para pricing con retroalimentación inmediata (¿compró o no a este precio?).

> 🔄 **v35:** se quitaron `stable-baselines3` y `gymnasium`. Stable-Baselines3 exige PyTorch, y su equivalente en TensorFlow (`tf-agents`) está abandonado desde 2023 y no funciona con TensorFlow actual.

### 2.11 Búsqueda semántica (embeddings)

```bash
pip install faiss-cpu
```

### 2.12 MLOps — entrenamiento, colas y cache

```bash
pip install mlflow celery redis
```

### 2.13 Utilidades específicas (parseo de correo para IA de soporte)

```bash
pip install mailparser
```

### 2.14 Testing

```bash
pip install pytest pytest-asyncio httpx
```

### 2.15 Congelar dependencias

```bash
pip freeze > requirements.txt
```

> Si prefieres `pyproject.toml` (Poetry/PEP 621) en vez de `requirements.txt`, indícalo y regenero esta sección.

---

## 3. Crear la estructura completa de carpetas y archivos

> Generado automáticamente a partir del árbol exacto de `02_FASTAPI.md` (10 módulos ML). Ejecutar dentro de la carpeta padre que contiene `ecommerce-fastapi/`.

```bash
mkdir -p \
  "ecommerce-fastapi/app" \
  "ecommerce-fastapi/app/module" \
  "ecommerce-fastapi/app/module/ml_prediction" \
  "ecommerce-fastapi/app/module/ml_prediction/controller" \
  "ecommerce-fastapi/app/module/ml_prediction/service" \
  "ecommerce-fastapi/app/module/ml_prediction/repository" \
  "ecommerce-fastapi/app/module/ml_prediction/model" \
  "ecommerce-fastapi/app/module/ml_prediction/schema" \
  "ecommerce-fastapi/app/module/ml_prediction/route" \
  "ecommerce-fastapi/app/module/ml_prediction/ml" \
  "ecommerce-fastapi/app/module/ml_prediction/exception" \
  "ecommerce-fastapi/app/module/image_recognition" \
  "ecommerce-fastapi/app/module/image_recognition/controller" \
  "ecommerce-fastapi/app/module/image_recognition/service" \
  "ecommerce-fastapi/app/module/image_recognition/repository" \
  "ecommerce-fastapi/app/module/image_recognition/model" \
  "ecommerce-fastapi/app/module/image_recognition/schema" \
  "ecommerce-fastapi/app/module/image_recognition/route" \
  "ecommerce-fastapi/app/module/image_recognition/ml" \
  "ecommerce-fastapi/app/module/image_recognition/exception" \
  "ecommerce-fastapi/app/module/sentiment_analysis" \
  "ecommerce-fastapi/app/module/sentiment_analysis/controller" \
  "ecommerce-fastapi/app/module/sentiment_analysis/service" \
  "ecommerce-fastapi/app/module/sentiment_analysis/repository" \
  "ecommerce-fastapi/app/module/sentiment_analysis/model" \
  "ecommerce-fastapi/app/module/sentiment_analysis/schema" \
  "ecommerce-fastapi/app/module/sentiment_analysis/route" \
  "ecommerce-fastapi/app/module/sentiment_analysis/ml" \
  "ecommerce-fastapi/app/module/sentiment_analysis/exception" \
  "ecommerce-fastapi/app/module/customer_analytics" \
  "ecommerce-fastapi/app/module/customer_analytics/controller" \
  "ecommerce-fastapi/app/module/customer_analytics/service" \
  "ecommerce-fastapi/app/module/customer_analytics/repository" \
  "ecommerce-fastapi/app/module/customer_analytics/model" \
  "ecommerce-fastapi/app/module/customer_analytics/schema" \
  "ecommerce-fastapi/app/module/customer_analytics/route" \
  "ecommerce-fastapi/app/module/customer_analytics/ml" \
  "ecommerce-fastapi/app/module/customer_analytics/exception" \
  "ecommerce-fastapi/app/module/fraud_detection" \
  "ecommerce-fastapi/app/module/fraud_detection/controller" \
  "ecommerce-fastapi/app/module/fraud_detection/service" \
  "ecommerce-fastapi/app/module/fraud_detection/repository" \
  "ecommerce-fastapi/app/module/fraud_detection/model" \
  "ecommerce-fastapi/app/module/fraud_detection/schema" \
  "ecommerce-fastapi/app/module/fraud_detection/route" \
  "ecommerce-fastapi/app/module/fraud_detection/ml" \
  "ecommerce-fastapi/app/module/fraud_detection/exception" \
  "ecommerce-fastapi/app/module/personalization" \
  "ecommerce-fastapi/app/module/personalization/controller" \
  "ecommerce-fastapi/app/module/personalization/service" \
  "ecommerce-fastapi/app/module/personalization/repository" \
  "ecommerce-fastapi/app/module/personalization/model" \
  "ecommerce-fastapi/app/module/personalization/schema" \
  "ecommerce-fastapi/app/module/personalization/route" \
  "ecommerce-fastapi/app/module/personalization/ml" \
  "ecommerce-fastapi/app/module/personalization/exception" \
  "ecommerce-fastapi/app/module/email_parser" \
  "ecommerce-fastapi/app/module/email_parser/controller" \
  "ecommerce-fastapi/app/module/email_parser/service" \
  "ecommerce-fastapi/app/module/email_parser/repository" \
  "ecommerce-fastapi/app/module/email_parser/model" \
  "ecommerce-fastapi/app/module/email_parser/schema" \
  "ecommerce-fastapi/app/module/email_parser/route" \
  "ecommerce-fastapi/app/module/email_parser/ml" \
  "ecommerce-fastapi/app/module/email_parser/exception" \
  "ecommerce-fastapi/app/module/natural_language" \
  "ecommerce-fastapi/app/module/natural_language/controller" \
  "ecommerce-fastapi/app/module/natural_language/service" \
  "ecommerce-fastapi/app/module/natural_language/repository" \
  "ecommerce-fastapi/app/module/natural_language/model" \
  "ecommerce-fastapi/app/module/natural_language/schema" \
  "ecommerce-fastapi/app/module/natural_language/route" \
  "ecommerce-fastapi/app/module/natural_language/ml" \
  "ecommerce-fastapi/app/module/natural_language/exception" \
  "ecommerce-fastapi/app/module/llm_assistant" \
  "ecommerce-fastapi/app/module/llm_assistant/controller" \
  "ecommerce-fastapi/app/module/llm_assistant/service" \
  "ecommerce-fastapi/app/module/llm_assistant/repository" \
  "ecommerce-fastapi/app/module/llm_assistant/model" \
  "ecommerce-fastapi/app/module/llm_assistant/schema" \
  "ecommerce-fastapi/app/module/llm_assistant/route" \
  "ecommerce-fastapi/app/module/llm_assistant/ml" \
  "ecommerce-fastapi/app/module/llm_assistant/exception" \
  "ecommerce-fastapi/app/module/demand_forecasting" \
  "ecommerce-fastapi/app/module/demand_forecasting/controller" \
  "ecommerce-fastapi/app/module/demand_forecasting/service" \
  "ecommerce-fastapi/app/module/demand_forecasting/repository" \
  "ecommerce-fastapi/app/module/demand_forecasting/model" \
  "ecommerce-fastapi/app/module/demand_forecasting/schema" \
  "ecommerce-fastapi/app/module/demand_forecasting/route" \
  "ecommerce-fastapi/app/module/demand_forecasting/ml" \
  "ecommerce-fastapi/app/module/demand_forecasting/exception" \
  "ecommerce-fastapi/app/module/price_optimization" \
  "ecommerce-fastapi/app/module/price_optimization/controller" \
  "ecommerce-fastapi/app/module/price_optimization/service" \
  "ecommerce-fastapi/app/module/price_optimization/repository" \
  "ecommerce-fastapi/app/module/price_optimization/model" \
  "ecommerce-fastapi/app/module/price_optimization/schema" \
  "ecommerce-fastapi/app/module/price_optimization/route" \
  "ecommerce-fastapi/app/module/price_optimization/ml" \
  "ecommerce-fastapi/app/module/price_optimization/exception" \
  "ecommerce-fastapi/app/shared" \
  "ecommerce-fastapi/app/shared/middleware" \
  "ecommerce-fastapi/app/shared/util" \
  "ecommerce-fastapi/app/shared/types" \
  "ecommerce-fastapi/app/shared/decorator" \
  "ecommerce-fastapi/app/shared/constants" \
  "ecommerce-fastapi/app/config" \
  "ecommerce-fastapi/migrations" \
  "ecommerce-fastapi/tests" \
  "ecommerce-fastapi/tests/unit" \
  "ecommerce-fastapi/tests/integration" \
  "ecommerce-fastapi/tests/ml" \
  "ecommerce-fastapi/notebooks" \
  "ecommerce-fastapi"

touch \
  "ecommerce-fastapi/app/module/ml_prediction/controller/ml_prediction_controller.py" \
  "ecommerce-fastapi/app/module/ml_prediction/service/ml_prediction_service.py" \
  "ecommerce-fastapi/app/module/ml_prediction/repository/ml_prediction_repository.py" \
  "ecommerce-fastapi/app/module/ml_prediction/model/ml_prediction_model.py" \
  "ecommerce-fastapi/app/module/ml_prediction/schema/ml_prediction_schema.py" \
  "ecommerce-fastapi/app/module/ml_prediction/route/ml_prediction_route.py" \
  "ecommerce-fastapi/app/module/ml_prediction/ml/model_evaluator.py" \
  "ecommerce-fastapi/app/module/ml_prediction/ml/feature_engineer.py" \
  "ecommerce-fastapi/app/module/ml_prediction/ml/model_loader.py" \
  "ecommerce-fastapi/app/module/ml_prediction/ml/xgboost_trainer.py" \
  "ecommerce-fastapi/app/module/ml_prediction/exception/ml_prediction_exception.py" \
  "ecommerce-fastapi/app/module/image_recognition/controller/image_recognition_controller.py" \
  "ecommerce-fastapi/app/module/image_recognition/service/image_recognition_service.py" \
  "ecommerce-fastapi/app/module/image_recognition/repository/image_recognition_repository.py" \
  "ecommerce-fastapi/app/module/image_recognition/model/image_recognition_model.py" \
  "ecommerce-fastapi/app/module/image_recognition/schema/image_recognition_schema.py" \
  "ecommerce-fastapi/app/module/image_recognition/route/image_recognition_route.py" \
  "ecommerce-fastapi/app/module/image_recognition/ml/resnet_classifier.py" \
  "ecommerce-fastapi/app/module/image_recognition/ml/clip_embedder.py" \
  "ecommerce-fastapi/app/module/image_recognition/ml/image_preprocessor.py" \
  "ecommerce-fastapi/app/module/image_recognition/ml/similarity_search.py" \
  "ecommerce-fastapi/app/module/image_recognition/exception/image_recognition_exception.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/controller/sentiment_controller.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/service/sentiment_service.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/repository/sentiment_repository.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/model/sentiment_model.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/schema/sentiment_schema.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/route/sentiment_route.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/ml/bert_sentiment.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/ml/multilingual_model.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/ml/sentiment_aggregator.py" \
  "ecommerce-fastapi/app/module/sentiment_analysis/exception/sentiment_exception.py" \
  "ecommerce-fastapi/app/module/customer_analytics/controller/customer_analytics_controller.py" \
  "ecommerce-fastapi/app/module/customer_analytics/service/customer_analytics_service.py" \
  "ecommerce-fastapi/app/module/customer_analytics/repository/customer_analytics_repository.py" \
  "ecommerce-fastapi/app/module/customer_analytics/model/customer_analytics_model.py" \
  "ecommerce-fastapi/app/module/customer_analytics/schema/customer_analytics_schema.py" \
  "ecommerce-fastapi/app/module/customer_analytics/route/customer_analytics_route.py" \
  "ecommerce-fastapi/app/module/customer_analytics/ml/kmeans_segmentation.py" \
  "ecommerce-fastapi/app/module/customer_analytics/ml/ltv_predictor.py" \
  "ecommerce-fastapi/app/module/customer_analytics/ml/rfm_analyzer.py" \
  "ecommerce-fastapi/app/module/customer_analytics/exception/customer_analytics_exception.py" \
  "ecommerce-fastapi/app/module/fraud_detection/controller/fraud_detection_controller.py" \
  "ecommerce-fastapi/app/module/fraud_detection/service/fraud_detection_service.py" \
  "ecommerce-fastapi/app/module/fraud_detection/repository/fraud_detection_repository.py" \
  "ecommerce-fastapi/app/module/fraud_detection/model/fraud_detection_model.py" \
  "ecommerce-fastapi/app/module/fraud_detection/schema/fraud_detection_schema.py" \
  "ecommerce-fastapi/app/module/fraud_detection/route/fraud_detection_route.py" \
  "ecommerce-fastapi/app/module/fraud_detection/ml/isolation_forest.py" \
  "ecommerce-fastapi/app/module/fraud_detection/ml/fraud_classifier.py" \
  "ecommerce-fastapi/app/module/fraud_detection/ml/risk_scorer.py" \
  "ecommerce-fastapi/app/module/fraud_detection/exception/fraud_detection_exception.py" \
  "ecommerce-fastapi/app/module/personalization/controller/personalization_controller.py" \
  "ecommerce-fastapi/app/module/personalization/service/personalization_service.py" \
  "ecommerce-fastapi/app/module/personalization/repository/personalization_repository.py" \
  "ecommerce-fastapi/app/module/personalization/model/personalization_model.py" \
  "ecommerce-fastapi/app/module/personalization/schema/personalization_schema.py" \
  "ecommerce-fastapi/app/module/personalization/route/personalization_route.py" \
  "ecommerce-fastapi/app/module/personalization/ml/collaborative_filter.py" \
  "ecommerce-fastapi/app/module/personalization/ml/content_based_filter.py" \
  "ecommerce-fastapi/app/module/personalization/ml/hybrid_recommender.py" \
  "ecommerce-fastapi/app/module/personalization/exception/personalization_exception.py" \
  "ecommerce-fastapi/app/module/email_parser/controller/email_parser_controller.py" \
  "ecommerce-fastapi/app/module/email_parser/service/email_parser_service.py" \
  "ecommerce-fastapi/app/module/email_parser/repository/email_parser_repository.py" \
  "ecommerce-fastapi/app/module/email_parser/model/email_parser_model.py" \
  "ecommerce-fastapi/app/module/email_parser/schema/email_parser_schema.py" \
  "ecommerce-fastapi/app/module/email_parser/route/email_parser_route.py" \
  "ecommerce-fastapi/app/module/email_parser/ml/ner_extractor.py" \
  "ecommerce-fastapi/app/module/email_parser/ml/intent_classifier.py" \
  "ecommerce-fastapi/app/module/email_parser/ml/email_preprocessor.py" \
  "ecommerce-fastapi/app/module/email_parser/exception/email_parser_exception.py" \
  "ecommerce-fastapi/app/module/natural_language/controller/nlp_controller.py" \
  "ecommerce-fastapi/app/module/natural_language/service/nlp_service.py" \
  "ecommerce-fastapi/app/module/natural_language/repository/nlp_repository.py" \
  "ecommerce-fastapi/app/module/natural_language/model/nlp_model.py" \
  "ecommerce-fastapi/app/module/natural_language/schema/nlp_schema.py" \
  "ecommerce-fastapi/app/module/natural_language/route/nlp_route.py" \
  "ecommerce-fastapi/app/module/natural_language/ml/rag_pipeline.py" \
  "ecommerce-fastapi/app/module/natural_language/ml/llm_connector.py" \
  "ecommerce-fastapi/app/module/natural_language/ml/intent_detector.py" \
  "ecommerce-fastapi/app/module/natural_language/ml/context_manager.py" \
  "ecommerce-fastapi/app/module/natural_language/exception/nlp_exception.py" \
  "ecommerce-fastapi/app/module/llm_assistant/controller/llm_controller.py" \
  "ecommerce-fastapi/app/module/llm_assistant/service/llm_service.py" \
  "ecommerce-fastapi/app/module/llm_assistant/repository/llm_repository.py" \
  "ecommerce-fastapi/app/module/llm_assistant/model/llm_model.py" \
  "ecommerce-fastapi/app/module/llm_assistant/schema/llm_schema.py" \
  "ecommerce-fastapi/app/module/llm_assistant/route/llm_route.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/llm_provider.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/ollama_provider.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/rag_retriever.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/knowledge_indexer.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/tool_registry.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/tool_executor.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/prompt_builder.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/guardrails.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/response_streamer.py" \
  "ecommerce-fastapi/app/module/llm_assistant/ml/llm_evaluator.py" \
  "ecommerce-fastapi/app/module/llm_assistant/exception/llm_exception.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/controller/forecasting_controller.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/service/forecasting_service.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/repository/forecasting_repository.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/model/forecasting_model.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/schema/forecasting_schema.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/route/forecasting_route.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/ml/prophet_model.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/ml/arima_model.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/ml/ensemble_forecaster.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/ml/seasonality_detector.py" \
  "ecommerce-fastapi/app/module/demand_forecasting/exception/forecasting_exception.py" \
  "ecommerce-fastapi/app/module/price_optimization/controller/pricing_controller.py" \
  "ecommerce-fastapi/app/module/price_optimization/service/pricing_service.py" \
  "ecommerce-fastapi/app/module/price_optimization/repository/pricing_repository.py" \
  "ecommerce-fastapi/app/module/price_optimization/model/pricing_model.py" \
  "ecommerce-fastapi/app/module/price_optimization/schema/pricing_schema.py" \
  "ecommerce-fastapi/app/module/price_optimization/route/pricing_route.py" \
  "ecommerce-fastapi/app/module/price_optimization/ml/rl_price_agent.py" \
  "ecommerce-fastapi/app/module/price_optimization/ml/xgboost_pricer.py" \
  "ecommerce-fastapi/app/module/price_optimization/ml/elasticity_calculator.py" \
  "ecommerce-fastapi/app/module/price_optimization/ml/competitor_analyzer.py" \
  "ecommerce-fastapi/app/module/price_optimization/exception/pricing_exception.py" \
  "ecommerce-fastapi/app/shared/middleware/auth_middleware.py" \
  "ecommerce-fastapi/app/shared/middleware/rate_limit_middleware.py" \
  "ecommerce-fastapi/app/shared/middleware/logging_middleware.py" \
  "ecommerce-fastapi/app/shared/middleware/error_middleware.py" \
  "ecommerce-fastapi/app/shared/util/model_cache.py" \
  "ecommerce-fastapi/app/shared/util/feature_store.py" \
  "ecommerce-fastapi/app/shared/util/metrics_util.py" \
  "ecommerce-fastapi/app/shared/util/pagination_util.py" \
  "ecommerce-fastapi/app/shared/types/common_types.py" \
  "ecommerce-fastapi/app/shared/types/ml_types.py" \
  "ecommerce-fastapi/app/shared/decorator/cache_decorator.py" \
  "ecommerce-fastapi/app/shared/decorator/validate_decorator.py" \
  "ecommerce-fastapi/app/shared/constants/ml_constants.py" \
  "ecommerce-fastapi/app/shared/constants/http_constants.py" \
  "ecommerce-fastapi/app/config/app_config.py" \
  "ecommerce-fastapi/app/config/database_config.py" \
  "ecommerce-fastapi/app/config/redis_config.py" \
  "ecommerce-fastapi/app/config/celery_config.py" \
  "ecommerce-fastapi/app/config/mlflow_config.py" \
  "ecommerce-fastapi/app/config/llm_config.py" \
  "ecommerce-fastapi/app/config/logging_config.py" \
  "ecommerce-fastapi/app/main.py" \
  "ecommerce-fastapi/app/worker.py" \
  "ecommerce-fastapi/notebooks/eda_predictions.ipynb" \
  "ecommerce-fastapi/notebooks/eda_images.ipynb" \
  "ecommerce-fastapi/notebooks/model_benchmarks.ipynb" \
  "ecommerce-fastapi/.env" \
  "ecommerce-fastapi/.env.example" \
  "ecommerce-fastapi/pyproject.toml" \
  "ecommerce-fastapi/alembic.ini" \
  "ecommerce-fastapi/Dockerfile"
```

---

## 4. Configurar Alembic y arrancar

```bash
alembic init alembic
uvicorn app.main:app --reload --port 8000
```
