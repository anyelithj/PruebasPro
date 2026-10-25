"""Fusiona el adaptador LoRA con su modelo base, exporta a GGUF cuantizado y lo registra en Ollama (Sprint 5.6).

Pasos: PEFT merge_and_unload (fp16) → llama.cpp convert_hf_to_gguf.py → llama-quantize (Q4_K_M) → `ollama create`.

Requisitos: los de train_qlora.py + un clon compilado de llama.cpp (--llama-cpp o variable LLAMA_CPP_DIR) + Ollama.
Uso (desde apps/ai-service):  python -m training.writing_corrector.export_gguf --llama-cpp C:/tools/llama.cpp

[Patrón]: Pipeline fuera de línea.
[Principio]: SRP — solo exporta y publica; el servicio lo consume por nombre (OLLAMA_CORRECTOR_MODEL).
[Paradigma]: Imperativo (script).
[Seguridad]: subprocess con lista de argumentos (sin shell) → sin inyección de comandos.
"""

import argparse
import os
import shutil
import subprocess  # stdlib: ejecuta llama.cpp y ollama
import sys
from pathlib import Path

from src.shared.config.settings import get_settings

ADAPTER = Path("data/own_llm/adapter")
MERGED = Path("data/own_llm/merged")
HERE = Path(__file__).parent  # El GGUF queda junto al Modelfile (FROM ./aula-corrector.gguf)
QUANT = "Q4_K_M"  # Buen equilibrio calidad/tamaño en CPU


def run(*cmd: str | Path) -> None:
    print("$", " ".join(map(str, cmd)))
    subprocess.run([str(c) for c in cmd], check=True)  # `check=True`: aborta el pipeline si un paso falla


def main() -> None:
    parser = argparse.ArgumentParser(description="Exporta el corrector a GGUF y lo registra en Ollama")
    parser.add_argument("--llama-cpp", type=Path, default=os.environ.get("LLAMA_CPP_DIR"))
    parser.add_argument("--version", default="1", help="Versión que se guarda en la ficha del modelo")
    args = parser.parse_args()
    if not args.llama_cpp:
        sys.exit("Indica --llama-cpp o LLAMA_CPP_DIR")

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    base = (ADAPTER / "base_model.txt").read_text(encoding="utf-8").strip()
    model = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.float16)
    PeftModel.from_pretrained(model, str(ADAPTER)).merge_and_unload().save_pretrained(str(MERGED))  # Pesos LoRA sumados al base
    AutoTokenizer.from_pretrained(base).save_pretrained(str(MERGED))

    f16 = MERGED / "model-f16.gguf"
    target = HERE / "aula-corrector.gguf"
    run(sys.executable, args.llama_cpp / "convert_hf_to_gguf.py", MERGED, "--outfile", f16, "--outtype", "f16")
    quantize = shutil.which("llama-quantize", path=str(args.llama_cpp / "build" / "bin")) or "llama-quantize"
    run(quantize, f16, target, QUANT)
    run("ollama", "create", get_settings().ollama_corrector_model, "-f", HERE / "Modelfile")
    (MERGED.parent / "export.txt").write_text(f"version={args.version}\nquantization={QUANT}\nbase={base}\n", encoding="utf-8")  # La lee run_eval.py
    print("Publicado. Evalúa antes de usarlo:  python -m tests.evaluation.run_eval")


if __name__ == "__main__":
    main()
