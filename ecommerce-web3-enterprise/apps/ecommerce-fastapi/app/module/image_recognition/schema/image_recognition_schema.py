# image_recognition_schema.py (Pydantic v2) => contratos de salida (DTO) de la API de visión.
# La entrada es multipart/form-data (archivo + campos de formulario): la valida el controller con
# UploadFile/Form de FastAPI. Patrón: DTO. Paradigma: declarativo + tipado estático.

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# Label => etiqueta ImageNet con su probabilidad (Value Object)
class Label(BaseModel):
    label: str
    score: float


# ClassifyResponse => salida de POST /classify y GET /:id (getEmbeddingById)
class ClassifyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # Entidad SQLAlchemy -> DTO sin mapeo manual
    id: str
    product_id: str | None
    filename: str
    labels: list[Label]
    embedding: list[float]  # 512 valores con norma 1 (CLIP ViT-B/32)
    created_at: datetime


# SearchItem => un producto parecido a la imagen consultada
class SearchItem(BaseModel):
    product_id: str
    embedding_id: str
    similarity: float  # Coseno 0-1 (1 = idéntica)
    labels: list[Label]


# ColorShare / VisualAttributes => RF-06.4 lo reconocido en la foto (colores, patrón, textura, logo)
class ColorShare(BaseModel):
    name: str  # Nombre de la paleta ("azul", "negro"...)
    hex: str  # Color real promedio del cluster (#rrggbb)
    share: float  # Fracción de la imagen (0-1)


class VisualAttributes(BaseModel):
    colors: list[ColorShare]
    patterns: list[Label]
    textures: list[Label]
    brands: list[Label]  # Marcas del catálogo cuyo logo se reconoce (vacío si "sin logo" gana)


# SearchResponse => salida de POST /search (listImageSearchResults)
class SearchResponse(BaseModel):
    items: list[SearchItem]
    attributes: VisualAttributes | None = None


# QualityReport / ModerationReport / InspectResponse => RF-06.6 salida de POST /inspect
class QualityReport(BaseModel):
    score: int  # 0-100 (cada problema resta 20)
    width: int
    height: int
    sharpness: float  # Varianza del Laplaciano (mayor = más nítida)
    brightness: float  # Brillo medio 0-255
    contrast: float  # Desviación estándar del gris
    issues: list[str]  # low_resolution | blurry | too_dark | too_bright | low_contrast


class ModerationReport(BaseModel):
    flagged: bool  # True => contenido no apto: no se publica
    category: str | None  # nudity | violence | weapon | drugs | hate
    scores: dict[str, float]


class InspectResponse(BaseModel):
    quality: QualityReport
    moderation: ModerationReport
