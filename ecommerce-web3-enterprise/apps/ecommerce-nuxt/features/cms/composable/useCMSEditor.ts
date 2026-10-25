// useCMSEditor.ts (Composable + GrapesJS) => ciclo de vida del editor visual drag-and-drop: crear (import dinámico:
// GrapesJS ~300 KB solo se descarga al abrir el editor), cargar el proyecto guardado, registrar bloques, exponer
// HTML/CSS/proyecto para guardar y DESTRUIR al salir (libera memoria y listeners).
// Patrones: Facade (la UI no conoce la API de GrapesJS), Observer (evento "update" => cambios sin guardar) y Strategy
// (dispositivos de vista previa). Paradigma reactivo (shallowRef) + asíncrono.
import { onBeforeUnmount, onMounted, shallowRef, type Ref } from "vue";
import type { Editor } from "grapesjs";
import type { CmsBlock } from "~~/entities/cms/model/cms.types";
import { useCmsStore, type PreviewDevice } from "../model/cms.store";

interface EditorOptions {
  container: Ref<HTMLElement | null>;
  blocks: CmsBlock[];
  project: Record<string, unknown> | null; // Proyecto JSON guardado (re-edición sin perder estructura)
  html: string; // Fallback: HTML guardado si no hay proyecto
}

const DEVICES: Record<PreviewDevice, { name: string; width: string }> = {
  desktop: { name: "Desktop", width: "" },
  tablet: { name: "Tablet", width: "768px" },
  mobile: { name: "Mobile", width: "375px" },
};

export function useCMSEditor(options: EditorOptions) {
  const store = useCmsStore();
  const editor = shallowRef<Editor | null>(null); // shallowRef => el objeto del editor no se vuelve reactivo (pesado)

  onMounted(async () => {
    if (!options.container.value) return;
    // Import dinámico => code splitting: el resto del panel no carga GrapesJS
    const [{ default: grapesjs }] = await Promise.all([import("grapesjs"), import("grapesjs/dist/css/grapes.min.css")]);
    const instance = grapesjs.init({
      container: options.container.value,
      height: "100%",
      storageManager: false, // Se guarda en Express (no en localStorage)
      fromElement: false,
      deviceManager: { devices: Object.entries(DEVICES).map(([id, device]) => ({ id, name: device.name, width: device.width })) },
      blockManager: { blocks: options.blocks.map((block) => ({ id: block.id, label: block.label, category: block.category, content: block.content })) },
      ...(options.project ? { projectData: options.project } : { components: options.html }),
    });
    instance.on("update", () => store.markDirty()); // Observer: cualquier cambio en el lienzo
    store.markDirty(false);
    editor.value = instance;
  });

  // onBeforeUnmount => destruye el editor: quita el iframe, listeners y memoria del lienzo
  onBeforeUnmount(() => {
    editor.value?.destroy();
    editor.value = null;
  });

  const setDevice = (device: PreviewDevice) => {
    store.setDevice(device);
    editor.value?.setDevice(device);
  };

  // snapshot => lo que se guarda en Express: HTML, CSS y proyecto JSON
  const snapshot = () => (editor.value ? { html: editor.value.getHtml(), css: editor.value.getCss() ?? "", project: editor.value.getProjectData() as Record<string, unknown> } : null);

  const undo = () => editor.value?.UndoManager.undo();
  const redo = () => editor.value?.UndoManager.redo();

  return { editor, setDevice, snapshot, undo, redo };
}
