"""Final pass: en-dashes and Entidad-Relación style hyphens between Spanish words."""
import re
from pathlib import Path

src = Path(r"C:\Users\angui\Documents\proyDemo\scripts\build_thesis.py")
text = src.read_text(encoding='utf-8')

# Replace en-dash with 'a' (date ranges) — context-safe substitution
text = text.replace(' – ', ' a ')

# Compound Spanish hyphenated words: rewrite a few common ones
text = text.replace('Entidad-Relación', 'Entidad Relacion')
text = text.replace('cuasi-experimental', 'cuasi experimental')
text = text.replace('empírica-mente', 'empiricamente')

src.write_text(text, encoding='utf-8')
print('OK')
