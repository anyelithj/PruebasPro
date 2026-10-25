from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
for idx in [491, 496, 500]:
    p = doc.paragraphs[idx]
    has_image = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
    print(f"[{idx}] Text: {p.text} | Has Image: {has_image}")
