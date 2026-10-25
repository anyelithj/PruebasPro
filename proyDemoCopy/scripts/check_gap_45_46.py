from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
for i in range(825, 831):
    p = doc.paragraphs[i]
    print(f"[{i}] Style: {p.style.name:15} | Text: '{p.text}'")
    for r in p.runs:
        has_img = "drawing" in r._element.xml or "picture" in r._element.xml
        if has_img:
            print(f"  Run: [IMAGE] '{r.text}'")
        elif r.text.strip():
            print(f"  Run: '{r.text}'")
