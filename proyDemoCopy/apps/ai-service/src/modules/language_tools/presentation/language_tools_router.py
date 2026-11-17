"""Router del módulo LanguageTools (voz, IPA y traducción locales).

[Patrón]: Controller (MVC) + Thin Controller + Composition Root (las factorías `get_*` arman los casos de uso).
[Principio]: SRP — traduce HTTP ↔ caso de uso · DIP (los casos de uso reciben puertos).
[Paradigma]: Funcional + asíncrono.
[Seguridad]: requiere el JWT que propaga NestJS (CurrentUserDep).
[Sprint 8.1]: /translate, /ipa, /lookup, /word y /lines (RF-106, RF-107, RF-136) + /languages y /accents; [2026-10-27]: /detect y source="auto" en /translate y /lookup; NestJS cachea los resultados (LanguageLookup).
"""

from functools import partial  # stdlib: fija tema y propósito del adaptador RAG
from src.modules.feedback.infrastructure.clients.rag_retriever import rag_references  # [Tarea 9]: adaptador RAG compartido
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
from src.modules.language_tools.application.schemas.catalog_response import AccentsResponse, LanguageOut
from src.modules.language_tools.application.schemas.detect_request import DetectRequest, DetectResponse
from src.modules.language_tools.application.schemas.ipa_request import IpaRequest, IpaResponse
from src.modules.language_tools.application.schemas.lines_request import LinesRequest, LinesResponse
from src.modules.language_tools.application.schemas.lookup_response import LookupResponse
from src.modules.language_tools.application.schemas.speak_request import SpeakRequest
from src.modules.language_tools.application.schemas.translate_request import TranslateRequest, TranslateResponse
from src.modules.language_tools.application.schemas.word_request import WordRequest, WordResponse
from src.modules.language_tools.application.use_cases.enrich_lines import EnrichLinesUseCase
from src.modules.language_tools.application.use_cases.lookup_term import LookupTermUseCase
from src.modules.language_tools.application.use_cases.lookup_word import LookupWordUseCase
from src.modules.language_tools.application.use_cases.noun_grammar import NounGrammarBatchRequest, NounGrammarRequest, NounGrammarResponse, NounGrammarUseCase
from src.modules.language_tools.application.use_cases.synthesize_speech import SynthesizeSpeechUseCase
from src.modules.language_tools.application.use_cases.transcribe_ipa import TranscribeIpaUseCase
from src.modules.language_tools.application.use_cases.translate_text import TranslateTextUseCase
from src.modules.language_tools.infrastructure.translation_cache import TranslationCache
from src.modules.language_tools.domain.language_voices import ACCENT_VARIANT, DEFAULT_VARIANT, VOICES
from src.modules.language_tools.infrastructure.clients.espeak_phonetizer import EspeakPhonetizer, get_phonetizer
from src.modules.language_tools.infrastructure.clients.espeak_speech import EspeakSpeech, get_speech_synthesizer
from src.shared.config.settings import get_settings
from src.shared.domain.language_detect import detect_language
from src.shared.dependencies.auth_deps import CurrentUserDep

router = APIRouter(prefix="/language-tools", tags=["language-tools"])

PhonetizerDep = Annotated[EspeakPhonetizer, Depends(get_phonetizer)]


def get_speak_use_case(
    synthesizer: Annotated[EspeakSpeech, Depends(get_speech_synthesizer)],
) -> SynthesizeSpeechUseCase:
    return SynthesizeSpeechUseCase(synthesizer)


# [Factorías · Sprint 8.1]: un OllamaClient por petición (sin estado) + el fonetizador determinista
# [Caché de proceso · 2026-10-25]: traducciones validadas compartidas entre peticiones (singleton de módulo; el caso de uso es por petición)
_TRANSLATION_CACHE = TranslationCache()


def get_translate_use_case() -> TranslateTextUseCase:
    # [Tarea 9]: frases y expresiones revisadas del RAG como referencias de traducción (adaptador compartido)
    references = partial(rag_references, theme="frases", purpose="traduccion")
    return TranslateTextUseCase(OllamaClient(timeout=60.0), get_settings().ollama_model, _TRANSLATION_CACHE, references)  # [2026-10-20]: 60 s → carga en frío del modelo sin perder la traducción


def get_ipa_use_case(phonetizer: PhonetizerDep) -> TranscribeIpaUseCase:
    return TranscribeIpaUseCase(phonetizer)


TranslateDep = Annotated[TranslateTextUseCase, Depends(get_translate_use_case)]
IpaDep = Annotated[TranscribeIpaUseCase, Depends(get_ipa_use_case)]


@router.post(
    "/speak",
    summary="Pronunciar un texto (WAV) con la voz local de su idioma y variante",
    response_class=Response,
    responses={
        # [OpenAPI · Sprint 11.2]: `format: binary` → Swagger UI ofrece descargar/reproducir el WAV y el cliente generado lo tipa como Blob
        200: {"content": {"audio/wav": {"schema": {"type": "string", "format": "binary"}}}},
        503: {"description": "Motor de voz no disponible"},
    },
)
async def speak(
    payload: SpeakRequest,
    _user: CurrentUserDep,
    use_case: Annotated[SynthesizeSpeechUseCase, Depends(get_speak_use_case)],
) -> Response:
    result = await use_case.execute(payload)
    # Cabeceras `X-*`: el backend las guarda con el audio (trazabilidad: qué voz y variante se usaron)
    return Response(
        content=result.audio,
        media_type="audio/wav",
        headers={
            "X-Voice": result.voice,
            "X-Variant": result.variant,
            "X-Engine": result.engine,
        },
    )


@router.post("/translate", summary="Traducir un término o una frase (alternativas y registro)")
async def translate(payload: TranslateRequest, _user: CurrentUserDep, use_case: TranslateDep) -> TranslateResponse:
    return await use_case.execute(payload)


# [Detectar idioma · 2026-10-27]: determinista (escritura + marcadores + langdetect), sin LLM → respuesta en < 5 ms
@router.post("/detect", summary="Detectar el idioma de un texto entre los 7 de la plataforma")
async def detect(payload: DetectRequest, _user: CurrentUserDep) -> DetectResponse:
    d = detect_language(payload.text)
    return DetectResponse(language=d.language, confidence=d.confidence, method=d.method)  # type: ignore[arg-type]


@router.post("/ipa", summary="IPA por palabra y completo (UK y US en inglés)")
async def ipa(payload: IpaRequest, _user: CurrentUserDep, use_case: IpaDep) -> IpaResponse:
    return await use_case.execute(payload)


@router.post("/lookup", summary="Traducción + IPA UK y US en una sola respuesta")
async def lookup(
    payload: TranslateRequest, _user: CurrentUserDep, translate_uc: TranslateDep, ipa_uc: IpaDep
) -> LookupResponse:
    return await LookupTermUseCase(translate_uc, ipa_uc).execute(payload)


@router.post("/word", summary="Palabra en su frase: traducción según el contexto, IPA y dos ejemplos")
async def word(payload: WordRequest, _user: CurrentUserDep, ipa_uc: IpaDep) -> WordResponse:
    return await LookupWordUseCase(OllamaClient(timeout=75.0), ipa_uc).execute(payload)  # [Fix 2026-10-30]: con el tope por defecto (30 s) la traducción de la palabra salía vacía «a veces» en CPU (tarda ~32 s); 75 s < 90 s del adaptador de NestJS


@router.post("/noun-grammar", summary="Gramática obligatoria del término: artículo, género, plural, clasificador, pinyin")
async def noun_grammar(payload: NounGrammarRequest, _user: CurrentUserDep) -> NounGrammarResponse:
    return await NounGrammarUseCase(OllamaClient(timeout=75.0)).execute(payload)


@router.post("/noun-grammar/batch", summary="Gramática obligatoria de varios términos en una sola llamada al LLM")
async def noun_grammar_batch(payload: NounGrammarBatchRequest, _user: CurrentUserDep) -> list[NounGrammarResponse]:
    return await NounGrammarUseCase(OllamaClient(timeout=120.0)).execute_many(payload)


@router.post("/lines", summary="Traducción e IPA por línea (canciones y diálogos)")
async def lines(
    payload: LinesRequest, _user: CurrentUserDep, translate_uc: TranslateDep, phonetizer: PhonetizerDep
) -> LinesResponse:
    return await EnrichLinesUseCase(translate_uc, phonetizer).execute(payload)


@router.get("/languages", response_model=list[LanguageOut], summary="Idiomas admitidos con su variante por defecto y voz de espeak-ng")
async def list_languages(_user: CurrentUserDep) -> list[dict[str, str]]:
    return [{"language": lang, "variant": v, "voice": VOICES[v]} for lang, v in DEFAULT_VARIANT.items()]


@router.get("/accents", response_model=AccentsResponse, summary="Acentos del interruptor UK/US (solo inglés)")
async def list_accents(_user: CurrentUserDep, phonetizer: PhonetizerDep) -> dict[str, object]:
    return {
        "accents": [{"accent": a, "variant": v, "voice": VOICES[v]} for a, v in ACCENT_VARIANT.items()],
        "engine": phonetizer.engine,
    }


@router.get("/health", summary="Sonda de salud del módulo")
async def health(phonetizer: PhonetizerDep) -> dict[str, str]:
    return {"status": "ok", "engine": phonetizer.engine}
