"""Ajuste fino QLoRA del corrector de redacciones (Sprint 5.6 · RF-144).

Modelo base pequeño (por defecto Qwen2.5-1.5B-Instruct) cargado en 4 bits (bitsandbytes NF4) + adaptador LoRA
entrenado con TRL SFTTrainer sobre data/own_llm/train.jsonl (lo genera prepare_dataset.py).

Requisitos (solo en la máquina de entrenamiento, GPU CUDA; no se instalan con el servicio):
    pip install "transformers>=4.46" "peft>=0.13" "trl>=0.12" bitsandbytes accelerate datasets

Uso (desde apps/ai-service):  python -m training.writing_corrector.train_qlora --epochs 3

[Patrón]: Pipeline fuera de línea + Adapter (LoRA: el modelo base no se modifica).
[Principio]: SRP — solo entrena; exportar a GGUF es export_gguf.py.
[Paradigma]: Imperativo (script).
"""

import argparse
from pathlib import Path

DEFAULT_BASE = "Qwen/Qwen2.5-1.5B-Instruct"  # Multilingüe, licencia Apache-2.0, cabe en una GPU de 8 GB con QLoRA
DATA = Path("data/own_llm/train.jsonl")
OUT = Path("data/own_llm/adapter")


def main() -> None:
    parser = argparse.ArgumentParser(description="QLoRA del corrector de redacciones")
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--rank", type=int, default=16)
    args = parser.parse_args()

    # Imports perezosos: el servicio nunca carga torch/peft/trl por este archivo
    import torch
    from datasets import load_dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    model = AutoModelForCausalLM.from_pretrained(
        args.base,
        # [QLoRA]: pesos base congelados en 4 bits NF4; cómputo en bfloat16
        quantization_config=BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16
        ),
        device_map="auto",
    )
    dataset = load_dataset("json", data_files=str(DATA), split="train").remove_columns(["reference"])

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=dataset,  # Formato conversacional prompt/completion → la pérdida se calcula solo sobre la respuesta
        peft_config=LoraConfig(r=args.rank, lora_alpha=args.rank * 2, lora_dropout=0.05, target_modules="all-linear", task_type="CAUSAL_LM"),
        args=SFTConfig(
            output_dir=str(OUT),
            num_train_epochs=args.epochs,
            learning_rate=args.lr,
            per_device_train_batch_size=4,
            gradient_accumulation_steps=4,
            gradient_checkpointing=True,
            bf16=True,
            logging_steps=10,
            save_strategy="epoch",
            report_to="none",
        ),
    )
    trainer.train()
    trainer.save_model(str(OUT))  # Solo el adaptador LoRA (MB, no GB)
    (OUT / "base_model.txt").write_text(args.base, encoding="utf-8")  # export_gguf.py sabe sobre qué base fusionar
    print(f"Adaptador guardado en {OUT.resolve()}")


if __name__ == "__main__":
    main()
