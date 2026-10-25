from docx import Document
import re

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
print("--- FULL FIGURE LIST ---")
for i, p in enumerate(doc.paragraphs):
    match = re.search(r'Figura (\d+)', p.text)
    if match:
        print(f"[{i}] {p.text}")
        # Print next 2 paras for title/note
        for j in range(1, 4):
            if i+j < len(doc.paragraphs):
                print(f"  +{j}: {doc.paragraphs[i+j].text}")
