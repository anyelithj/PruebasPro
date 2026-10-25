from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
for i, p in enumerate(doc.paragraphs):
    if p.text.startswith("Nota."):
        is_italic = False
        if p.runs:
            # Check if the word "Nota." is in an italic run
            for r in p.runs:
                if "Nota." in r.text and r.italic:
                    is_italic = True
                    break
        print(f"[{i}] '{p.text[:30]}...' Italic: {is_italic}")
