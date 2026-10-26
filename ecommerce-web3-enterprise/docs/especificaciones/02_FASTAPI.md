# 🤖 BACKEND — FastAPI Python
## eCommerce Web3 Enterprise · N-Layer Architecture · 11 Módulos ML
## TensorFlow · XGBoost · CLIP · Prophet · LangChain · SQLAlchemy Async · pgvector · Pydantic v2

---

```
ecommerce-fastapi/
├── app/
│   ├── module/                                       # N-Layer ML domain modules
│   │   │
│   │   ├── ── ML PREDICTIONS DOMAIN ───────────────────────
│   │   │
│   │   ├── ml_prediction/                            # ML Predictions (XGBoost · Prophet)
│   │   │   ├── controller/
│   │   │   │   └── ml_prediction_controller.py       # FastAPI·Pydantic|Guard·Strat|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── ml_prediction_service.py          # XGBoost·Prophet|Strategy|N-Lyr|Async·Data|ML inference
│   │   │   ├── repository/
│   │   │   │   └── ml_prediction_repository.py       # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── ml_prediction_model.py            # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Domain entity
│   │   │   ├── schema/
│   │   │   │   └── ml_prediction_schema.py           # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── ml_prediction_route.py            # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── model_evaluator.py                # XGBoost·sklearn|Factory|N-Lyr|Data·Func|RMSE/MAE/R²
│   │   │   │   ├── feature_engineer.py               # Pandas·NumPy|Pipeline|N-Lyr|Data·Func|Feature prep
│   │   │   │   ├── model_loader.py                   # MLflow·joblib|Factory·Sing|N-Lyr|Async·Data|Load/cache model
│   │   │   │   └── xgboost_trainer.py                # XGBoost·MLflow|Strategy|N-Lyr|Data·Async|Train pipeline
│   │   │   └── exception/
│   │   │       └── ml_prediction_exception.py        # Python|Exception|N-Lyr|POO|ML errors
│   │   │
│   │   ├── ── IMAGE RECOGNITION DOMAIN ────────────────────
│   │   │
│   │   ├── image_recognition/                        # Image Recognition (ResNet-50 · CLIP)
│   │   │   ├── controller/
│   │   │   │   └── image_recognition_controller.py   # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── image_recognition_service.py      # TF·CLIP (KHub)|Strategy|N-Lyr|Async·Data|Classify/search
│   │   │   ├── repository/
│   │   │   │   └── image_recognition_repository.py   # SQLAlch·pgvector|Repository|N-Lyr|Async·POO|Embedding store
│   │   │   ├── model/
│   │   │   │   └── image_recognition_model.py        # SQLAlch·pgvector|ActiveRecord|N-Lyr|POO|Embedding entity
│   │   │   ├── schema/
│   │   │   │   └── image_recognition_schema.py       # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── image_recognition_route.py        # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── resnet_classifier.py              # TF·ResNet50|Pipeline·Strat|N-Lyr|Data·Func|Classify top-k
│   │   │   │   ├── clip_embedder.py                  # CLIP·ViT-B/32|Strategy|N-Lyr|Data·Func|512-dim embed
│   │   │   │   ├── visual_attributes.py              # NumPy·CLIP|Strategy·Facade|N-Lyr|Data·Func|RF-06.4 color/patrón/logo
│   │   │   │   ├── image_quality.py                  # Pillow·NumPy·CLIP|Strategy|N-Lyr|Data·Func|RF-06.6 calidad/moderación
│   │   │   │   ├── image_preprocessor.py             # tf.image·PIL|Pipeline|N-Lyr|Func|Resize/normalize
│   │   │   │   └── similarity_search.py              # pgvector·NumPy|Repository·ANN|N-Lyr|Async·Data|Cosine ANN search
│   │   │   └── exception/
│   │   │       └── image_recognition_exception.py    # Python|Exception|N-Lyr|POO|CV errors
│   │   │
│   │   ├── ── SENTIMENT ANALYSIS DOMAIN ───────────────────
│   │   │
│   │   ├── sentiment_analysis/                       # Sentiment Analysis (BERT · Transformers)
│   │   │   ├── controller/
│   │   │   │   └── sentiment_controller.py           # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── sentiment_service.py              # BERT·HuggingFace|Strategy|N-Lyr|Async·Data|Sentiment logic
│   │   │   ├── repository/
│   │   │   │   └── sentiment_repository.py           # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── sentiment_model.py                # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Score entity
│   │   │   ├── schema/
│   │   │   │   └── sentiment_schema.py               # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── sentiment_route.py                # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── bert_sentiment.py                 # BERT·Transformers|Strategy|N-Lyr|Data·Func|Classify pos/neg
│   │   │   │   ├── multilingual_model.py             # mBERT·Transformers|Strategy|N-Lyr|Data·Func|Multi-lang NLP
│   │   │   │   ├── social_insights.py                # Python·Counter|Strategy·Pipeline|N-Lyr|Data·Func|RF-15.10/15.11 emociones y causas negativas
│   │   │   │   └── sentiment_aggregator.py           # Pandas·NumPy|Pipeline|N-Lyr|Data·Func|Aggregate scores
│   │   │   └── exception/
│   │   │       └── sentiment_exception.py            # Python|Exception|N-Lyr|POO|NLP errors
│   │   │
│   │   ├── ── CUSTOMER ANALYTICS DOMAIN ───────────────────
│   │   │
│   │   ├── customer_analytics/                       # Customer Analytics (K-Means · LTV)
│   │   │   ├── controller/
│   │   │   │   └── customer_analytics_controller.py  # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── customer_analytics_service.py     # sklearn·XGBoost|Strategy|N-Lyr|Async·Data|Segment/LTV
│   │   │   ├── repository/
│   │   │   │   └── customer_analytics_repository.py  # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── customer_analytics_model.py       # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Segment entity
│   │   │   ├── schema/
│   │   │   │   └── customer_analytics_schema.py      # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── customer_analytics_route.py       # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── kmeans_segmentation.py            # sklearn·KMeans|Strategy|N-Lyr|Data·Func|Customer cluster
│   │   │   │   ├── ltv_predictor.py                  # XGBoost·sklearn|Strategy|N-Lyr|Data·Func|Lifetime value
│   │   │   │   └── rfm_analyzer.py                   # Pandas·NumPy|Pipeline|N-Lyr|Data·Func|RFM analysis
│   │   │   └── exception/
│   │   │       └── customer_analytics_exception.py   # Python|Exception|N-Lyr|POO|Analytics errors
│   │   │
│   │   ├── ── FRAUD DETECTION DOMAIN ──────────────────────
│   │   │
│   │   ├── fraud_detection/                          # Fraud Detection (IsolationForest · XGBoost)
│   │   │   ├── controller/
│   │   │   │   └── fraud_detection_controller.py     # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── fraud_detection_service.py        # sklearn·XGBoost|Strategy|N-Lyr|Async·Data|Fraud detect
│   │   │   ├── repository/
│   │   │   │   └── fraud_detection_repository.py     # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── fraud_detection_model.py          # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Alert entity
│   │   │   ├── schema/
│   │   │   │   └── fraud_detection_schema.py         # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── fraud_detection_route.py          # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── isolation_forest.py               # sklearn·IsolForest|Strategy|N-Lyr|Data·Func|Anomaly detect
│   │   │   │   ├── fraud_classifier.py               # XGBoost·sklearn|Strategy|N-Lyr|Data·Func|Binary classify
│   │   │   │   └── risk_scorer.py                    # NumPy·Pandas|Pipeline|N-Lyr|Data·Func|Risk score 0-1
│   │   │   └── exception/
│   │   │       └── fraud_detection_exception.py      # Python|Exception|N-Lyr|POO|Fraud errors
│   │   │
│   │   ├── ── PERSONALIZATION DOMAIN ──────────────────────
│   │   │
│   │   ├── personalization/                          # Personalization Engine (Collaborative Filtering)
│   │   │   ├── controller/
│   │   │   │   └── personalization_controller.py     # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── personalization_service.py        # FAISS·sklearn|Strategy|N-Lyr|Async·Data|Recommend logic
│   │   │   ├── repository/
│   │   │   │   └── personalization_repository.py     # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── personalization_model.py          # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Profile entity
│   │   │   ├── schema/
│   │   │   │   └── personalization_schema.py         # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── personalization_route.py          # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── collaborative_filter.py           # sklearn·FAISS|Strategy|N-Lyr|Data·Func|User-item matrix
│   │   │   │   ├── content_based_filter.py           # CLIP·NumPy|Strategy|N-Lyr|Data·Func|Feature similarity
│   │   │   │   └── hybrid_recommender.py             # sklearn·NumPy|Strategy·Fact|N-Lyr|Data·Func|Blend CF + CBF
│   │   │   └── exception/
│   │   │       └── personalization_exception.py      # Python|Exception|N-Lyr|POO|Personlz errors
│   │   │
│   │   ├── ── EMAIL PARSER DOMAIN ─────────────────────────
│   │   │
│   │   ├── email_parser/                             # Email Parser (BERT · NER · spaCy)
│   │   │   ├── controller/
│   │   │   │   └── email_parser_controller.py        # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── email_parser_service.py           # BERT·spaCy|Strategy|N-Lyr|Async·Data|Parse logic
│   │   │   ├── repository/
│   │   │   │   └── email_parser_repository.py        # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── email_parser_model.py             # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Email entity
│   │   │   ├── schema/
│   │   │   │   └── email_parser_schema.py            # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── email_parser_route.py             # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── ner_extractor.py                  # spaCy·BERT|Pipeline|N-Lyr|Data·Func|Entity extract
│   │   │   │   ├── intent_classifier.py              # BERT·sklearn|Strategy|N-Lyr|Data·Func|Email intent
│   │   │   │   └── email_preprocessor.py             # regex·bs4|Pipeline|N-Lyr|Func|Clean/parse HTML
│   │   │   └── exception/
│   │   │       └── email_parser_exception.py         # Python|Exception|N-Lyr|POO|Parser errors
│   │   │
│   │   ├── ── NATURAL LANGUAGE DOMAIN ─────────────────────
│   │   │
│   │   ├── natural_language/                         # Natural Language (LLM · RAG · Ollama)
│   │   │   ├── controller/
│   │   │   │   └── nlp_controller.py                 # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── nlp_service.py                    # Ollama·LangChain|Strategy|N-Lyr|Async·Data|NLP/RAG logic
│   │   │   ├── repository/
│   │   │   │   └── nlp_repository.py                 # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── nlp_model.py                      # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Chat entity
│   │   │   ├── schema/
│   │   │   │   └── nlp_schema.py                     # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── nlp_route.py                      # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── rag_pipeline.py                   # FAISS·LangChain|Pipeline·Strat|N-Lyr|Async·Data|RAG retrieval
│   │   │   │   ├── llm_connector.py                  # Ollama·Llama3|Adapter·Sing|N-Lyr|Async·Data|LLM interface
│   │   │   │   ├── intent_detector.py                # BERT·Transformers|Strategy|N-Lyr|Data·Func|Intent classify
│   │   │   │   ├── query_normalizer.py               # difflib·Python|Pipeline|N-Lyr|Func|RF-17.9 ortografía y sinónimos
│   │   │   │   ├── entity_extractor.py               # spaCy·regex|Composite|N-Lyr|Func|RF-17.2 producto, cantidad, dirección
│   │   │   │   ├── nlu_metrics.py                    # Python|Strategy|N-Lyr|Func|RF-17.12 precisión intenciones/entidades
│   │   │   │   └── context_manager.py                # Redis·Python|Observer|N-Lyr|Async·Data|Session context
│   │   │   └── exception/
│   │   │       └── nlp_exception.py                  # Python|Exception|N-Lyr|POO|NLP errors
│   │   │
│   │   ├── ── LLM ASSISTANT DOMAIN ─────────────────────────
│   │   │
│   │   ├── llm_assistant/                            # LLM Assistant (RAG · Tool Use · SSE) — API LLM propia
│   │   │   ├── controller/
│   │   │   │   └── llm_controller.py                 # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing + SSE
│   │   │   ├── service/
│   │   │   │   └── llm_service.py                    # LangChain·Ollama|Strategy|N-Lyr|Async·Data|RAG+tools orchestration
│   │   │   ├── repository/
│   │   │   │   └── llm_repository.py                 # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── llm_model.py                      # SQLAlch·pgvector|ActiveRecord|N-Lyr|POO|Chat/chunk/tool entity
│   │   │   ├── schema/
│   │   │   │   └── llm_schema.py                     # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── llm_route.py                      # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── llm_provider.py                   # Python·ABC|Adapter·Strat|N-Lyr|POO|LLMProvider port
│   │   │   │   ├── ollama_provider.py                # Ollama·Llama3|Adapter·Sing|N-Lyr|Async·Data|Local LLM (default)
│   │   │   │   ├── rag_retriever.py                  # pgvector·LC|Pipeline·Strat|N-Lyr|Async·Data|ANN semantic search
│   │   │   │   ├── knowledge_indexer.py              # Celery·pgvector|Pipeline|N-Lyr|Async·Data|Chunk + embed index
│   │   │   │   ├── tool_registry.py                  # Python·Pydantic|Registry·Fact|N-Lyr|POO·Typed|Tool catalog
│   │   │   │   ├── tool_executor.py                  # httpx·JWT|Guard·Adapter|N-Lyr|Async·Data|Call Express APIs
│   │   │   │   ├── prompt_builder.py                 # LangChain|Builder|N-Lyr|Func|Prompt + context
│   │   │   │   ├── guardrails.py                     # Pydantic v2|Chain-Resp|N-Lyr|Func|PII + output check
│   │   │   │   ├── response_streamer.py              # FastAPI·SSE|Observer|N-Lyr|Async|Token streaming
│   │   │   │   └── llm_evaluator.py                  # MLflow·pytest|Strategy|N-Lyr|Data·Func|Faithfulness/latency
│   │   │   └── exception/
│   │   │       └── llm_exception.py                  # Python|Exception|N-Lyr|POO|LLM/tool errors
│   │   │
│   │   ├── ── DEMAND FORECASTING DOMAIN ───────────────────
│   │   │
│   │   ├── demand_forecasting/                       # Demand Forecasting (Prophet · ARIMA)
│   │   │   ├── controller/
│   │   │   │   └── forecasting_controller.py         # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── forecasting_service.py            # Prophet·statsmod|Strategy|N-Lyr|Async·Data|Forecast logic
│   │   │   ├── repository/
│   │   │   │   └── forecasting_repository.py         # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── forecasting_model.py              # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Forecast entity
│   │   │   ├── schema/
│   │   │   │   └── forecasting_schema.py             # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── forecasting_route.py              # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── ml/
│   │   │   │   ├── prophet_model.py                  # Prophet·Pandas|Strategy|N-Lyr|Data·Func|Time-series fcst
│   │   │   │   ├── arima_model.py                    # statsmodels|Strategy|N-Lyr|Data·Func|ARIMA forecast
│   │   │   │   ├── ensemble_forecaster.py            # Prophet+ARIMA|Strategy·Fact|N-Lyr|Data·Func|Blend models
│   │   │   │   ├── promotion_simulator.py            # NumPy·Pandas|Pipeline·Strategy|N-Lyr|Data·Func|RF-24.14 impacto de promociones/eventos
│   │   │   │   └── seasonality_detector.py           # Pandas·NumPy|Pipeline|N-Lyr|Data·Func|Pattern detect
│   │   │   └── exception/
│   │   │       └── forecasting_exception.py          # Python|Exception|N-Lyr|POO|Forecast errors
│   │   │
│   │   ├── ── PRICE OPTIMIZATION DOMAIN ───────────────────
│   │   │
│   │   └── price_optimization/                       # Price Optimization (Reinforcement · XGBoost)
│   │       ├── controller/
│   │       │   └── pricing_controller.py             # FastAPI·Pydantic|Guard|N-Lyr|Async·POO|HTTP routing
│   │       ├── service/
│   │       │   └── pricing_service.py                # XGBoost·RL|Strategy|N-Lyr|Async·Data|Pricing logic
│   │       ├── repository/
│   │       │   └── pricing_repository.py             # SQLAlch·PG|Repository|N-Lyr|Async·POO|DB queries
│   │       ├── model/
│   │       │   └── pricing_model.py                  # SQLAlch·TS|ActiveRecord|N-Lyr|POO|Decision entity
│   │       ├── schema/
│   │       │   └── pricing_schema.py                 # Pydantic v2|Schema·DTO|N-Lyr|Func|I/O contracts
│   │       ├── route/
│   │       │   └── pricing_route.py                  # FastAPI·Router|Chain-Resp|N-Lyr|Async|Route config
│   │       ├── ml/
│   │       │   ├── rl_price_agent.py                 # NumPy (bandit)|Strategy|N-Lyr|Data·Func|Contextual bandit price agent
│   │       │   ├── markdown_optimizer.py             # itertools·Python|Strategy|N-Lyr|Func|RF-18.10 rebajas ingresos/utilidad
│   │       │   ├── xgboost_pricer.py                 # XGBoost·sklearn|Strategy|N-Lyr|Data·Func|Price predict
│   │       │   ├── elasticity_calculator.py          # NumPy·Pandas|Pipeline|N-Lyr|Data·Func|Price elasticity
│   │       │   └── competitor_analyzer.py            # Pandas·Requests|Pipeline|N-Lyr|Async·Data|Market prices
│   │       └── exception/
│   │           └── pricing_exception.py              # Python|Exception|N-Lyr|POO|Pricing errors
│   │
│   ├── shared/                                       # Código compartido entre módulos ML
│   │   ├── middleware/
│   │   │   ├── auth_middleware.py                    # JWT·FastAPI|Guard|N-Lyr|Async·POO|Token validate
│   │   │   ├── rate_limit_middleware.py              # Redis·Limits|Throttle|N-Lyr|Async|Rate limiting
│   │   │   ├── logging_middleware.py                 # Loguru·Python|Observer|N-Lyr|Async|Request log
│   │   │   └── error_middleware.py                   # FastAPI|Chain-Resp|N-Lyr|POO|Error handler
│   │   ├── util/
│   │   │   ├── model_cache.py                        # Redis·Pickle|Singleton|N-Lyr|Async·Func|ML model cache
│   │   │   ├── feature_store.py                      # Redis·Pandas|Repository|N-Lyr|Async·Data|Feature cache
│   │   │   ├── metrics_util.py                       # sklearn·NumPy|Util|N-Lyr|Func|RMSE/MAE/R²/AUC
│   │   │   └── pagination_util.py                    # Python|Util|N-Lyr|Func|Cursor paginate
│   │   ├── types/
│   │   │   ├── common_types.py                       # Python·Pydantic|VO|N-Lyr|Typed|Shared types
│   │   │   └── ml_types.py                           # Python·Pydantic|VO|N-Lyr|Typed|ML result types
│   │   ├── decorator/
│   │   │   ├── cache_decorator.py                    # Redis·functools|Decorator|N-Lyr|Func|Cache results
│   │   │   └── validate_decorator.py                 # Pydantic v2|Decorator|N-Lyr|Func|Input validate
│   │   └── constants/
│   │       ├── ml_constants.py                       # Python|Config|N-Lyr|Typed|ML thresholds
│   │       └── http_constants.py                     # Python|Config|N-Lyr|Typed|HTTP codes
│   │
│   ├── config/                                       # Configuración global
│   │   ├── app_config.py                             # Pydantic·Settings|Singleton|N-Lyr|POO|App config
│   │   ├── database_config.py                        # SQLAlch·Async|Singleton|N-Lyr|Async·POO|DB connection
│   │   ├── redis_config.py                           # aioredis|Singleton|N-Lyr|Async·POO|Cache config
│   │   ├── celery_config.py                          # Celery·Redis|Singleton|N-Lyr|POO|Task queue
│   │   ├── mlflow_config.py                          # MLflow·Python|Singleton|N-Lyr|POO|Experiment track
│   │   ├── llm_config.py                             # Pydantic·Settings|Singleton|N-Lyr|POO|LLM provider config
│   │   └── logging_config.py                         # Loguru|Singleton|N-Lyr|POO|Log config
│   │
│   ├── main.py                                       # FastAPI·Uvicorn|Facade|N-Lyr|Async·POO|App bootstrap
│   └── worker.py                                     # Celery·Redis|Worker|N-Lyr|Async|Async ML tasks
│
├── migrations/                                       # Alembic·SQLAlch|Migration|-|-|DB versions
├── tests/
│   ├── unit/                                         # pytest·Python|-|-|-|Unit tests
│   ├── integration/                                  # pytest·httpx|-|-|-|Integration tests
│   └── ml/                                           # pytest·sklearn|-|-|-|Model accuracy tests
│
├── notebooks/                                        # Jupyter·Python|Exploration|-|-|Research/EDA
│   ├── eda_predictions.ipynb                         # Pandas·Seaborn|Exploration|-|Data|EDA predictions
│   ├── eda_images.ipynb                              # CV2·Matplotlib|Exploration|-|Data|EDA images
│   └── model_benchmarks.ipynb                        # sklearn·MLflow|Exploration|-|Data|Model compare
│
├── .env                                              # -|Config|-|-|Env variables
├── .env.example                                      # -|Config|-|-|Env template
├── pyproject.toml                                    # Poetry·Python|Config|-|-|Dependencies
├── alembic.ini                                       # Alembic|Config|-|-|Migration config
└── Dockerfile                                        # Docker|Infra|-|-|Container
```

---

## ABREVIATURAS

| Abr.         | Significado                              |
|--------------|------------------------------------------|
| N-Lyr        | N-Layer Architecture                     |
| POO          | Programación Orientada a Objetos         |
| Data         | Data-Driven Programming                  |
| Func         | Functional Programming                   |
| Async        | Asynchronous (non-blocking)              |
| Typed        | Strongly Typed                           |
| Strat        | Strategy Pattern                         |
| Repo         | Repository Pattern                       |
| Guard        | Guard / Middleware Pattern               |
| Pipeline     | Pipeline Pattern                         |
| Fact         | Factory Pattern                          |
| Sing         | Singleton Pattern                        |
| Adapt        | Adapter Pattern                          |
| Obs          | Observer Pattern                         |
| Chain-Resp   | Chain of Responsibility Pattern          |
| ANN          | Approximate Nearest Neighbor             |
| DTO          | Data Transfer Object                     |
| VO           | Value Object                             |
| ORM          | Object Relational Mapper                 |
| SQLAlch      | SQLAlchemy Async 2.0                     |
| PG           | PostgreSQL                               |
| RL           | Reinforcement Learning                   |
| NER          | Named Entity Recognition                 |
| RAG          | Retrieval-Augmented Generation           |
| LLM          | Large Language Model                     |
| RFM          | Recency Frequency Monetary (analysis)    |
| CF           | Collaborative Filtering                  |
| CBF          | Content-Based Filtering                  |
| EDA          | Exploratory Data Analysis                |
| LC           | LangChain                                |
| MLOps        | Machine Learning Operations              |
| SSE          | Server-Sent Events (streaming)           |
| Tool Use     | Llamada a herramientas por el LLM        |
| Registry     | Registry Pattern                         |
| Builder      | Builder Pattern                          |
| ABC          | Abstract Base Class                      |
