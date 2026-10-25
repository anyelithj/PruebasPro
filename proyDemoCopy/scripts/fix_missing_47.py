import os
import re
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def add_missing_figure_47():
    doc = Document(SRC)
    
    # Find Figura 46 (index 827) and Figura 48 (was 47, now at index 833)
    fig46_idx = -1
    fig48_idx = -1
    for i, p in enumerate(doc.paragraphs):
        if "Figura 46" in p.text:
            fig46_idx = i
        if "Figura 48" in p.text: # Wait, my previous script renumbered 46->47, so the old 47 is now 48? No, old 46 is now 47.
             pass

    # Let's just find the unlabeled image between Figura 46 and the next one
    target_idx = -1
    for i in range(828, len(doc.paragraphs)):
        p = doc.paragraphs[i]
        if "Figura" in p.text:
            break
        has_image = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
        if has_image and not p.text.strip():
            target_idx = i
            break
            
    if target_idx == -1:
        print("No more unlabeled images found")
        return
        
    print(f"Found target image at index {target_idx}")

    # Renumber all figures from 47 upwards
    # Wait, if old 46 is now 47, and I want to insert a NEW 47, I must renumber 47->48, 48->49...
    for p in doc.paragraphs:
        match = re.search(r'Figura (\d+)', p.text)
        if match:
            num = int(match.group(1))
            if num >= 47:
                for r in p.runs:
                    if f"Figura {num}" in r.text:
                        r.text = r.text.replace(f"Figura {num}", f"Figura {num+1}")
                if f"Figura {num}" in p.text and f"Figura {num+1}" not in p.text:
                     p.text = p.text.replace(f"Figura {num}", f"Figura {num+1}")

    # Insert new Figura 47
    target_p = doc.paragraphs[target_idx]
    target_p.style = "Figure Label"
    target_p.text = "Figura 47"
    
    p_title = doc.add_paragraph()
    target_p._element.addnext(p_title._element)
    p_title.style = "Caption"
    rt = p_title.add_run("Pruebas Funcionales: Generación de Planes de Estudio con IA")
    rt.italic = True
    
    p_note = doc.add_paragraph()
    p_title._element.addnext(p_note._element)
    p_note.style = "Figure Note"
    p_note.add_run("Nota. pruebas funcionales: generación de planes de estudio con IA, por , 2026.")

    doc.save(DST)
    print("Figura 47 added and subsequent figures renumbered.")

if __name__ == "__main__":
    add_missing_figure_47()
