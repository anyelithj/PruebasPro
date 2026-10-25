// [Test materiales]: detección de tipo por MIME o extensión (PDF/imagen sin `file.type` en Windows) | [Patrón]: Unit Test puro
import { MATERIAL_ACCEPT, materialMime } from "@/types/courses";

describe("materialMime", () => {
  it("acepta PDF, imágenes y video aunque el navegador no aporte tipo", () => {
    expect(materialMime({ type: "", name: "Guia.PDF" })).toBe("application/pdf");
    expect(materialMime({ type: "", name: "foto.jpg" })).toBe("image/jpeg");
    expect(materialMime({ type: "image/png", name: "x" })).toBe("image/png");
    expect(materialMime({ type: "video/mp4", name: "clase.mp4" })).toBe("video/mp4");
  });
  it("rechaza tipos fuera de la lista blanca (SVG, ejecutables)", () => {
    expect(materialMime({ type: "image/svg+xml", name: "x.svg" })).toBeUndefined();
    expect(materialMime({ type: "", name: "virus.exe" })).toBeUndefined();
  });
  it("el selector de archivos filtra por extensión (incluye .pdf e imágenes)", () => {
    expect(MATERIAL_ACCEPT.split(",")).toEqual(expect.arrayContaining([".pdf", ".png", ".jpg", ".mp4"]));
  });
});
