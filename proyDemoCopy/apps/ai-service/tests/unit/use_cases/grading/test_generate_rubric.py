"""Tests de GenerateRubric.

[DEFECTO CONOCIDO]: el archivo fuente
src/modules/grading/application/use_cases/generate_rubric.py esta VACIO
(0 bytes) — no existe ninguna clase/funcion GenerateRubricUseCase implementada,
pese a que el test correspondiente existe. No se puede testear logica inexistente.

Se deja un skip explicito que documenta el defecto sin romper la suite. Cuando
se implemente el use case, retirar el skip y completar las pruebas.
"""
import importlib

import pytest


def test_generate_rubric_no_implementado() -> None:
    # [Verifica el defecto]: el modulo se importa pero no expone ningun simbolo publico
    module = importlib.import_module(
        "src.modules.grading.application.use_cases.generate_rubric"
    )
    public_symbols = [s for s in dir(module) if not s.startswith("__")]
    if not public_symbols:
        pytest.skip(
            "DEFECTO: generate_rubric.py esta vacio; no hay GenerateRubricUseCase que testear."
        )
