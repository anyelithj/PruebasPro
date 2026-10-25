// media.service.spec.ts => pruebas del caso de uso de subida: se inyecta un repositorio falso (DIP),
// así el test no llama a Cloudinary ni necesita credenciales.
import { MediaService } from "../../src/module/media/service/media.service";
import type { MediaRepository } from "../../src/module/media/repository/media.repository";
import { NoFilesException, NothingToUpdateException } from "../../src/module/media/exception/media.exception";

// "jest.mock" (se eleva al inicio del archivo) => evita cargar el repositorio real, que lee variables de entorno
jest.mock("../../src/module/media/repository/media.repository", () => ({ mediaRepository: {} }));
// RF-06.6 motor de visión falso: sin red (el test no depende de que FastAPI esté encendido)
jest.mock("../../src/module/media/util/vision.util", () => ({ inspectImage: jest.fn(async () => null) }));
import { inspectImage } from "../../src/module/media/util/vision.util";
import { InappropriateImageException } from "../../src/module/media/exception/media.exception";

// Doble de prueba: "save" devuelve un asset determinista por cada buffer
const fakeRepository = {
  save: jest.fn(async (buffer: Buffer, folder: string) => ({ url: `https://cdn/${folder}/${buffer.length}`, publicId: `p${buffer.length}`, width: 1, height: 1 })),
  remove: jest.fn(async () => undefined),
  replace: jest.fn(async (publicId: string, _buffer: Buffer | undefined, alt: string | undefined) => ({ url: "u", publicId, width: 1, height: 1, alt })),
  removeMany: jest.fn(async () => undefined),
} as unknown as MediaRepository;

describe("MediaService", () => {
  const service = new MediaService(fakeRepository);

  it("rechaza una subida sin archivos", async () => {
    await expect(service.uploadImages([], "products")).rejects.toBeInstanceOf(NoFilesException);
  });

  it("sube todos los archivos y conserva el orden", async () => {
    const result = await service.uploadImages([Buffer.alloc(1), Buffer.alloc(2)], "brands");
    expect(result.map((asset) => asset.publicId)).toEqual(["p1", "p2"]);
  });

  it("RF-06.6 bloquea el lote si una foto de producto tiene contenido no apto", async () => {
    jest.mocked(inspectImage).mockResolvedValueOnce({ quality: { score: 100, width: 800, height: 800, issues: [] }, moderation: { flagged: true, category: "weapon" } });
    await expect(service.uploadImages([Buffer.alloc(1)], "products")).rejects.toBeInstanceOf(InappropriateImageException);
  });

  it("rechaza un PATCH sin archivo ni texto alternativo", async () => {
    await expect(service.updateImage("ecommerce-web3/products/a", undefined, undefined)).rejects.toBeInstanceOf(NothingToUpdateException);
  });

  it("actualiza solo los metadatos cuando no llega archivo", async () => {
    const asset = await service.updateImage("ecommerce-web3/products/a", undefined, "Zapato rojo");
    expect(asset.alt).toBe("Zapato rojo");
  });
});
