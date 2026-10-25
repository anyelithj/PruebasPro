import os
import re
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def master_cleanup():
    doc = Document(SRC)
    
    # 1. First pass: Identify all figure labels and re-sequence them properly from the first duplicate
    
    # Let's find the first duplicate 33 (at 745)
    
    # Actually, let's just do a global re-sequencing from 1 to N.
    # But some figures might be missing.
    
    current_num = 1
    for i, p in enumerate(doc.paragraphs):
        # Find any paragraph starting with "Figura" or containing "Figura \d+"
        match = re.search(r'Figura \d+', p.text)
        if match:
            old_label = match.group(0)
            new_label = f"Figura {current_num}"
            
            # Clean the paragraph if it has merged text (e.g. at 827)
            if old_label != p.text.strip():
                # It has merged text. Split it.
                remaining_text = p.text.replace(old_label, "").strip()
                p.text = new_label
                p.style = "Figure Label"
                
                if remaining_text:
                    # Insert the remaining text as a caption if it looks like one
                    new_p = doc.add_paragraph(remaining_text)
                    p._element.addnext(new_p._element)
                    new_p.style = "Caption"
            else:
                p.text = new_label
                p.style = "Figure Label"
            
            current_num += 1

    # 2. Fix the mess at 830-832 if it still exists
    # Actually, the global re-sequencing will fix the numbers.
    
    doc.save(DST)
    print("Master cleanup and re-sequencing completed.")

if __name__ == "__main__":
    master_cleanup()
