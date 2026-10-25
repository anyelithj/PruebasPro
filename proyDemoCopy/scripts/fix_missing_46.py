import os
import re
from docx import Document
from docx.shared import Pt

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def add_missing_figure_45_46():
    doc = Document(SRC)
    
    # 1. Find indices
    fig45_idx = -1
    fig46_idx = -1
    for i, p in enumerate(doc.paragraphs):
        if "Figura 45" in p.text:
            fig45_idx = i
        if "Figura 46" in p.text:
            fig46_idx = i
            break
            
    if fig45_idx == -1 or fig46_idx == -1:
        print(f"Figures not found: 45={fig45_idx}, 46={fig46_idx}")
        return

    # 2. Find the image between them
    target_idx = -1
    for i in range(fig45_idx + 1, fig46_idx):
        p = doc.paragraphs[i]
        has_image = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
        if has_image and not p.text.strip():
            target_idx = i
            break
            
    if target_idx == -1:
        print("No unlabeled image found between 45 and 46")
        return
        
    print(f"Found target image at index {target_idx}")

    # 3. Renumber all figures from 46 upwards
    for p in doc.paragraphs:
        # Match "Figura XX" exactly at the start of a run or paragraph
        match = re.search(r'Figura (\d+)', p.text)
        if match:
            num = int(match.group(1))
            if num >= 46:
                # Replace the text in the runs
                for r in p.runs:
                    if f"Figura {num}" in r.text:
                        r.text = r.text.replace(f"Figura {num}", f"Figura {num+1}")
                # Also check paragraph text if runs didn't catch it
                if f"Figura {num}" in p.text and f"Figura {num+1}" not in p.text:
                     p.text = p.text.replace(f"Figura {num}", f"Figura {num+1}")

    # 4. Insert the new figure label at target_idx
    target_p = doc.paragraphs[target_idx]
    target_p.style = "Figure Label"
    target_p.text = "Figura 46" # We renumbered the old 46 to 47
    
    # Insert Title and Note
    p_title = doc.add_paragraph()
    target_p._element.addnext(p_title._element)
    p_title.style = "Caption"
    rt = p_title.add_run("Pruebas Funcionales: Módulo de Feedback con IA")
    rt.italic = True
    
    p_note = doc.add_paragraph()
    p_title._element.addnext(p_note._element)
    p_note.style = "Figure Note"
    p_note.add_run("Nota. pruebas funcionales: módulo de feedback con IA, por , 2026.")

    doc.save(DST)
    print("Figura 46 added and subsequent figures renumbered.")

if __name__ == "__main__":
    add_missing_figure_45_46()
