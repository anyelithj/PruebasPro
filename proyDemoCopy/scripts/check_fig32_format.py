from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
for idx in [491, 492, 493]:
    p = doc.paragraphs[idx]
    print(f"[{idx}] '{p.text}'")
    for r in p.runs:
        print(f"  Run: '{r.text}' - Bold: {r.bold} - Italic: {r.italic}")
