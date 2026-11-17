"""Datos de entrenamiento QLoRA del corrector del Anexo A (2026-11-13 · Tarea 6 · RF-144): {entrada} -> {salida JSON}.

Cada ejemplo se emite DOS veces: sin «referencias» y con «referencias» (fragmentos revisados como los que entrega el RAG, Tarea 9) →
el modelo aprende que el campo es opcional y que la salida sigue siendo el mismo JSON. Incluye los Casos A, B y C y errores
típicos de voz a texto (homófonos: leave/live, his/is, tree/three…). Texto propio; sin contenido de terceros.
Los Casos A, B y C también están en el conjunto reservado (tests/evaluation/corrector_eval.jsonl) con otra variante de entrada.

[Patrón]: Pipeline ETL (seed → validación → registro) | [Principio]: SSOT (el MISMO prompt versionado y el MISMO contrato Pydantic que el servicio)
[Paradigma]: Funcional (todo puro salvo la escritura del archivo).
"""

from collections.abc import Iterator

from src.modules.own_llm.application.schemas.corrector_io import CorrectorInput, CorrectorOutput
from src.modules.own_llm.prompts import CORRECTOR_PROMPT

ART = "Artículos a / an: «a» va antes de sonido de consonante y «an» antes de sonido de vocal (an apple, a university). [fuente: Artículos]"
TO_BE = "Verbo to be: I am, you/we/they are, he/she/it is; sirve para decir quién eres, de dónde eres y cómo estás. [fuente: Verb to be]"
NAME = "Para decir tu nombre se usa «My name is…» (Me llamo…); para decir de dónde eres, «I'm from…» (Soy de…). [fuente: Introductions]"
EXPR = "Las expresiones y los títulos se traducen por su sentido: natural, cercana y literal, y se recomienda la natural. [fuente: Expressions]"


def _err(categoria: str, original: str, sugerencia: str, explicacion: str) -> dict:
    return {"categoria": categoria, "original": original, "sugerencia": sugerencia, "explicacion": explicacion}


# (entrada, salida, referencias de la variante «con referencias») — salidas escritas a mano y revisadas contra el Anexo A
SEED: tuple[tuple[dict, dict, list[str]], ...] = (
    (  # Caso A (= EJEMPLO 1 del Anexo A)
        {"pregunta_previa": "Hi! I'm Aula. What's your name, and where are you from?", "texto": "my niece is Laura I'm on from Columbia",
         "idioma": "en", "nivel": "A1", "tema": "presentarse", "tipo_de_texto": "frase", "origen": "voz"},
        {"frase_corregida": "My name is Laura. I'm from Colombia.", "veredicto": "con_errores", "errores": [
            _err("posible_error_de_transcripcion", "niece", "name", "Aula preguntó tu nombre; «niece» (sobrina) parece un error de reconocimiento de voz por «name»."),
            _err("mayuscula", "my", "My", "La primera palabra de la oración va con mayúscula."),
            _err("puntuacion", "Laura I'm", "Laura. I'm", "Cada oración termina con punto."),
            _err("gramatica", "I'm on from", "I'm from", "Para decir de dónde eres se usa «I'm from»; «on» sobra."),
            _err("ortografia", "Columbia", "Colombia", "En inglés el país se escribe «Colombia»; «Columbia» es otro lugar.")],
         "traduccion": "Me llamo Laura. Soy de Colombia.", "alternativas_traduccion": [], "comentario": "Casi lo tienes; repite la frase corregida en voz alta."},
        [NAME],
    ),
    (  # Caso B: el alumno pide ayuda en español en vez de responder
        {"pregunta_previa": "Let's practice the verb to be. Are you a student?", "texto": "no entendí el tema del verbo to be",
         "idioma": "en", "nivel": "A1", "tema": "verbo to be", "tipo_de_texto": "frase", "origen": "escrito"},
        {"frase_corregida": "no entendí el tema del verbo to be", "veredicto": "no_responde", "errores": [
            _err("no_responde_a_la_pregunta", "no entendí el tema del verbo to be", "Yes, I am a student.",
                 "Pediste ayuda con el verbo to be; para responder en inglés puedes decir «Yes, I am a student».")],
         "traduccion": "No entendí el tema del verbo to be.", "alternativas_traduccion": [], "comentario": "¡Buena pregunta! Repasemos el verbo to be juntos."},
        [TO_BE],
    ),
    (  # Caso C: título de canción
        {"pregunta_previa": "", "texto": "Hands To Myself", "idioma": "en", "nivel": "B1", "tema": "canciones", "tipo_de_texto": "titulo", "origen": "escrito"},
        {"frase_corregida": "Hands To Myself", "veredicto": "correcta", "errores": [], "traduccion": "No puedo contenerme",
         "alternativas_traduccion": [{"tipo": "natural", "texto": "No puedo contenerme"}, {"tipo": "cercana", "texto": "No puedo mantener mis manos quietas"},
                                     {"tipo": "literal", "texto": "Mis manos para mí"}],
         "comentario": "Es un título: se traduce por su sentido, no palabra por palabra."},
        [EXPR],
    ),
    (  # EJEMPLO 2
        {"pregunta_previa": "Do you like music?", "texto": "Yes, I like music very much.", "idioma": "en", "nivel": "A2", "tema": "hobbies", "tipo_de_texto": "frase", "origen": "escrito"},
        {"frase_corregida": "Yes, I like music very much.", "veredicto": "correcta", "errores": [], "traduccion": "Sí, me gusta mucho la música.",
         "alternativas_traduccion": [], "comentario": "¡Muy bien dicho!"},
        [],
    ),
    (  # EJEMPLO 3
        {"pregunta_previa": "", "texto": "It's raining cats and dogs.", "idioma": "en", "nivel": "B1", "tema": "clima", "tipo_de_texto": "expresion", "origen": "escrito"},
        {"frase_corregida": "It's raining cats and dogs.", "veredicto": "correcta", "errores": [], "traduccion": "Está lloviendo a cántaros.",
         "alternativas_traduccion": [{"tipo": "natural", "texto": "Está lloviendo a cántaros."}, {"tipo": "cercana", "texto": "Está lloviendo muchísimo."},
                                     {"tipo": "literal", "texto": "Está lloviendo gatos y perros."}],
         "comentario": "Es una expresión idiomática: no se traduce palabra por palabra."},
        [EXPR],
    ),
    (  # EJEMPLO 4
        {"pregunta_previa": "What do you have for breakfast?", "texto": "I have a apple.", "idioma": "en", "nivel": "A1", "tema": "comida", "tipo_de_texto": "frase", "origen": "escrito"},
        {"frase_corregida": "I have an apple.", "veredicto": "con_errores", "errores": [
            _err("gramatica", "a apple", "an apple", "«Apple» empieza con sonido de vocal, así que se usa «an».")],
         "traduccion": "Tengo una manzana.", "alternativas_traduccion": [], "comentario": "Muy bien; solo cambia «a» por «an»."},
        [ART],
    ),
    (  # Voz: homófono his/is
        {"pregunta_previa": "What's your name?", "texto": "my name his Pedro", "idioma": "en", "nivel": "A1", "tema": "presentarse", "tipo_de_texto": "frase", "origen": "voz"},
        {"frase_corregida": "My name is Pedro.", "veredicto": "con_errores", "errores": [
            _err("mayuscula", "my", "My", "La primera palabra de la oración va con mayúscula."),
            _err("posible_error_de_transcripcion", "his", "is", "«his» (su) suena como «is»; con «My name» va el verbo «is»."),
            _err("puntuacion", "Pedro", "Pedro.", "La oración termina con punto.")],
         "traduccion": "Me llamo Pedro.", "alternativas_traduccion": [], "comentario": "¡Bien! Solo era el reconocimiento de voz."},
        [NAME, TO_BE],
    ),
    (  # Voz: homófono leave/live
        {"pregunta_previa": "Where do you live?", "texto": "I leave in Medellin", "idioma": "en", "nivel": "A1", "tema": "ciudad", "tipo_de_texto": "frase", "origen": "voz"},
        {"frase_corregida": "I live in Medellin.", "veredicto": "con_errores", "errores": [
            _err("posible_error_de_transcripcion", "leave", "live", "Te preguntaron dónde vives: «live» (vivir); «leave» (irse) suena parecido."),
            _err("puntuacion", "Medellin", "Medellin.", "La oración termina con punto.")],
         "traduccion": "Vivo en Medellín.", "alternativas_traduccion": [], "comentario": "¡Muy bien! Repite «I live in Medellin»."},
        [],
    ),
    (  # Voz: homófono tree/three
        {"pregunta_previa": "How many cousins do you have?", "texto": "I have tree cousins", "idioma": "en", "nivel": "A1", "tema": "familia", "tipo_de_texto": "frase", "origen": "voz"},
        {"frase_corregida": "I have three cousins.", "veredicto": "con_errores", "errores": [
            _err("posible_error_de_transcripcion", "tree", "three", "Te preguntaron cuántos: «three» (tres); «tree» (árbol) suena parecido."),
            _err("puntuacion", "cousins", "cousins.", "La oración termina con punto.")],
         "traduccion": "Tengo tres primos.", "alternativas_traduccion": [], "comentario": "¡Bien dicho!"},
        [],
    ),
)  # fmt: skip


def variants(entrada: dict, salida: dict, refs: list[str]) -> Iterator[tuple[CorrectorInput, CorrectorOutput]]:
    """Sin referencias y, si hay, con referencias (máx. 5). Valida ambos lados con el contrato del servicio (Fail Fast)."""
    out = CorrectorOutput.model_validate(salida)
    yield CorrectorInput.model_validate(entrada), out
    if refs:
        yield CorrectorInput.model_validate({**entrada, "referencias": refs[:5]}), out


def to_annex_record(req: CorrectorInput, out: CorrectorOutput) -> dict:
    """Registro prompt/completion con el prompt versionado del Anexo A tal cual (lo entrenado = lo servido). Función pura."""
    return {
        "prompt": [
            {"role": "system", "content": CORRECTOR_PROMPT},
            {"role": "user", "content": req.model_dump_json(exclude=None if req.referencias else {"referencias"})},
        ],
        "completion": [{"role": "assistant", "content": out.model_dump_json()}],
        "reference": {"text": req.texto, "language": req.idioma, "level": req.nivel, "corrected_text": out.frase_corregida},
    }


def annex_records() -> list[dict]:
    return [to_annex_record(req, out) for entrada, salida, refs in SEED for req, out in variants(entrada, salida, refs)]
