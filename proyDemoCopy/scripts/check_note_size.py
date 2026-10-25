from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
p = doc.paragraphs[493]
if p.runs and p.runs[0].font.size:
    print(f"Size: {p.runs[0].font.size.pt}")
else:
    print("Size: Unknown (default)")
