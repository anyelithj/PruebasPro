import os
import re
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def fix_image_after_48():
    doc = Document(SRC)
    
    # Find current Figura 48 (should be at 827)
    fig48_idx = -1
    for i, p in enumerate(doc.paragraphs):
        if "Figura 48" in p.text:
            fig48_idx = i
            break
            
    if fig48_idx == -1:
        print("Figura 48 not found")
        return

    # Find first unlabeled image after 48
    target_idx = -1
    for i in range(fig48_idx + 1, len(doc.paragraphs)):
        p = doc.paragraphs[i]
        if "Figura" in p.text:
            break
        has_img = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
        if has_img and not p.text.strip():
            target_idx = i
            break
            
    if target_idx == -1:
        print("No unlabeled image found after 48 before next Figura")
        return
        
    print(f"Found unlabeled image at {target_idx}")

    # Renumber everything from current 49 upwards
    for p in doc.paragraphs:
        match = re.search(r'Figura (\d+)', p.text)
        if match:
            num = int(match.group(1))
            if num >= 49:
                for r in p.runs:
                    if f"Figura {num}" in r.text:
                        r.text = r.text.replace(f"Figura {num}", f"Figura {num+1}")
                if f"Figura {num}" in p.text and f"Figura {num+1}" not in p.text:
                    p.text = p.text.replace(f"Figura {num}", f"Figura {num+1}")

    # Insert label at target_idx
    target_p = doc.paragraphs[target_idx]
    target_p.text = "Figura 49"
    target_p.style = "Figure Label"
    
    p_title = doc.add_paragraph("Pruebas Funcionales: Creación de Cuestionarios con IA (Detalle)")
    target_p._element.addnext(p_title._element)
    p_title.style = "Caption"
    rt = p_title.add_run()
    rt.italic = True # Title should be italic
    
    p_note = doc.add_paragraph("Nota. pruebas funcionales: creación de cuestionarios con IA, por , 2026.")
    p_title._element.addnext(p_note._element)
    p_note.style = "Figure Note"

    doc.save(DST)
    print("Figura 49 added for the unlabeled image and subsequent figures renumbered.")

if __name__ == "__main__":
    fix_image_after_48()
