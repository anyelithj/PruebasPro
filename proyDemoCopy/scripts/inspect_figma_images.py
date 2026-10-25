import os
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"

def inspect_figma_section():
    if not os.path.exists(SRC):
        print(f"Error: {SRC} not found")
        return

    doc = Document(SRC)
    found_section = False
    found_fig32 = False
    
    for i, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        if "Prototipos de Interfaz: Figma" in text:
            found_section = True
            print(f"Found section at paragraph {i}: {text}")
            
        if found_section:
            if "Figura 32" in text:
                found_fig32 = True
                print(f"Found Figura 32 at paragraph {i}: {text}")
            
            # Look for images (inline shapes) in the following paragraphs
            if found_fig32:
                # Check for runs with images
                has_image = False
                for run in p.runs:
                    if "drawing" in run._element.xml or "picture" in run._element.xml:
                        has_image = True
                
                if has_image:
                    print(f"Paragraph {i} has an image. Text: '{text}'")
                elif text:
                    print(f"Paragraph {i} text: '{text}'")
                
                # Stop after some paragraphs to avoid dumping everything
                if i > doc.paragraphs.index(p) + 20 and found_fig32:
                    # Actually let's just look at the next 15 paras after fig 32
                    pass

if __name__ == "__main__":
    inspect_figma_section()
