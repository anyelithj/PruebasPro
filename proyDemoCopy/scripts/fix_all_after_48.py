import os
import re
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def fix_all_images_after_48():
    doc = Document(SRC)
    
    # Find current Figura 48
    fig48_idx = -1
    for i, p in enumerate(doc.paragraphs):
        if "Figura 48" in p.text:
            fig48_idx = i
            break
            
    if fig48_idx == -1:
        print("Figura 48 not found")
        return

    # Find ALL unlabeled images after 48 before the next "Figura X" (where X != current sequence)
    # Actually, let's just find the next "Figura" that was already there.
    # From previous turn, next is Figura 49 at 840 (now it might have shifted).
    
    unlabeled_indices = []
    next_fig_idx = len(doc.paragraphs)
    for i in range(fig48_idx + 1, len(doc.paragraphs)):
        p = doc.paragraphs[i]
        if "Figura" in p.text:
            next_fig_idx = i
            break
        has_img = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
        if has_img and not p.text.strip():
            unlabeled_indices.append(i)
            
    if not unlabeled_indices:
        print("No unlabeled images found after 48")
        return
        
    print(f"Found {len(unlabeled_indices)} unlabeled images at {unlabeled_indices}")

    # Renumber existing figures from the current "next" figure upwards
    # The current next figure is doc.paragraphs[next_fig_idx].
    # Let's say its number is N. We need to increment it and all after it by len(unlabeled_indices).
    
    match_next = re.search(r'Figura (\d+)', doc.paragraphs[next_fig_idx].text)
    if match_next:
        start_renum = int(match_next.group(1))
        increment = len(unlabeled_indices)
        
        # Renumber bottom-up
        for p in reversed(doc.paragraphs):
            m = re.search(r'Figura (\d+)', p.text)
            if m:
                num = int(m.group(1))
                if num >= start_renum:
                    old_l = f"Figura {num}"
                    new_l = f"Figura {num + increment}"
                    for r in p.runs:
                        if old_l in r.text:
                            r.text = r.text.replace(old_l, new_l)
                    if old_l in p.text and new_l not in p.text:
                        p.text = p.text.replace(old_l, new_l)

    # Insert new labels
    current_num = 49
    # We must insert them in order. Since indices in unlabeled_indices are sorted:
    # BUT inserting paragraphs shifts indices. 
    # Let's use the elements.
    
    for idx in unlabeled_indices:
        target_p = doc.paragraphs[idx]
        target_p.text = f"Figura {current_num}"
        target_p.style = "Figure Label"
        
        p_title = doc.add_paragraph()
        target_p._element.addnext(p_title._element)
        p_title.style = "Caption"
        title_text = "Pruebas Funcionales: Creación de Cuestionarios con IA (Detalle)"
        rt = p_title.add_run(title_text)
        rt.italic = True
        
        p_note = doc.add_paragraph()
        p_title._element.addnext(p_note._element)
        p_note.style = "Figure Note"
        p_note.text = "Nota. pruebas funcionales: creación de cuestionarios con IA, por , 2026."
        
        current_num += 1

    doc.save(DST)
    print(f"Added {len(unlabeled_indices)} figures starting from 49.")

if __name__ == "__main__":
    fix_all_images_after_48()
