# ml_constants.py (Python) => umbrales y límites de los modelos ML en un solo lugar (DRY, sin
# "números mágicos"). Patrón: Config (constantes tipadas con Final). Paradigma: declarativo.

from typing import Final  # "Final" => el type checker impide reasignar la constante

# --- Sprint 5.1 · Predicciones de demanda ---
# Máximo de días a predecir (más allá el error recursivo crece demasiado)
MAX_HORIZON_DAYS: Final = 90
MIN_TRAINING_DAYS: Final = 60  # Días de historial mínimos para entrenar (cubre ~8 ciclos semanales)
# Último 20 % del tiempo como validación (split temporal, sin mezclar futuro y pasado)
VALIDATION_RATIO: Final = 0.2
RANDOM_STATE: Final = 42  # Semilla fija => entrenamientos reproducibles
# Ensamble: Prophet se valida solo con los N productos más vendidos (un ajuste por producto;
# limitarlo ahorra CPU y energía sin perder señal: el resto aporta poco volumen)
MAX_PROPHET_VALIDATION_PRODUCTS: Final = 20
# A/B testing: % de productos (asignación estable por hash) que usan la versión "challenger"
AB_CHALLENGER_PERCENT: Final = 20
# Arranque en frío: productos visualmente similares (CLIP) cuya demanda se promedia
COLD_START_NEIGHBORS: Final = 5

# --- Sprint 5.1 · Pronóstico de demanda (demand_forecasting: Prophet + ARIMA) ---
FORECAST_HOLDOUT_DAYS: Final = 14  # Últimos días que el backtest esconde para medir el error
FORECAST_BACKTEST_DAYS: Final = 120  # Historia leída para el backtest (no toda la tabla: menos E/S)
Z_95: Final = 1.96  # Intervalo de confianza del 95 % (± 1.96 · RMSE del backtest)
ANOMALY_Z: Final = 3.5  # Z-score robusto (mediana/MAD) a partir del cual un día es atípico

# --- Sprint 5.2 · Reconocimiento de imágenes ---
EMBEDDING_DIM: Final = 512  # CLIP ViT-B/32 (coincide con vector(512) de pgvector)
IMAGE_SIZE: Final = 224  # Entrada de ResNet-50 y CLIP ViT-B/32 (Resize 256 -> CenterCrop 224)
RESIZE_SHORTER_SIDE: Final = 256
TOP_K_LABELS: Final = 5  # Etiquetas ImageNet devueltas por clasificación
MAX_SEARCH_RESULTS: Final = 24
MIN_SIMILARITY: Final = 0.2  # Coseno mínimo: por debajo el resultado no se parece de verdad
MAX_IMAGE_BYTES: Final = 5 * 1024 * 1024  # 5 MB (mismo límite que la subida de imágenes de Express)

# --- Fase 5B · LLM Assistant ---
TEXT_EMBEDDING_DIM: Final = 768  # granite-embedding:278m (OLLAMA_EMBED_MODEL) => vector(768)
KNOWLEDGE_CHUNK_CHARS: Final = 600  # Tamaño de fragmento RAG (~150 tokens: contexto corto)
KNOWLEDGE_CHUNK_OVERLAP: Final = 80  # Solapamiento: una idea partida queda completa en un fragmento
MAX_TOOL_CALLS_PER_TURN: Final = (
    3  # Herramientas por respuesta (acota latencia y llamadas a Express)
)
MAX_TOOL_RESULT_CHARS: Final = 1500  # Resultado de herramienta que ve el LLM (menos tokens)
