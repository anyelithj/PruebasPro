// brand.model.ts => entidad de dominio Brand (POO): encapsula la regla de borrado.
import type { BrandDto } from "../dto/brand.dto";

export class BrandEntity {
  // "private readonly" => estado inmutable encapsulado; se expone solo mediante métodos
  constructor(
    private readonly data: BrandDto,
    private readonly logoPublicId: string | null
  ) {}

  public get id(): string {
    return this.data.id;
  }

  // Regla de negocio: solo se elimina una marca sin productos activos
  public canBeDeleted(): boolean {
    return this.data.productCount === 0;
  }

  public get activeProducts(): number {
    return this.data.productCount;
  }

  // Asset de Cloudinary a limpiar cuando se reemplaza/elimina el logo
  public get currentLogoPublicId(): string | null {
    return this.logoPublicId;
  }

  public toJSON(): BrandDto {
    return this.data;
  }
}
