// permission.service.ts => lógica de negocio: gestión granular de permisos
import { permissionRepository, type PermissionRepository } from "../repository/permission.repository";
import {
  PermissionNotFoundException,
  PermissionAlreadyExistsException,
  PermissionInUseException,
} from "../exception/permission.exception";
import type { CreatePermissionDto, UpdatePermissionDto, PermissionResponseDto } from "../dto/permission.dto";

export class PermissionService {
  private readonly repository: PermissionRepository;

  constructor(repository: PermissionRepository) {
    this.repository = repository;
  }

  public async listPermissions(): Promise<PermissionResponseDto[]> {
    const permissions = await this.repository.listPermissions();
    return permissions.map((permission) => permission.toResponseJSON());
  }

  public async getPermissionById(id: string): Promise<PermissionResponseDto> {
    const permission = await this.repository.findById(id);
    if (!permission) throw new PermissionNotFoundException(id);
    return permission.toResponseJSON();
  }

  // createPermission => caso de uso "crear permiso con acción y recurso"
  public async createPermission(dto: CreatePermissionDto): Promise<PermissionResponseDto> {
    // Regla de negocio: el par (action, resource) debe ser único (evita permisos duplicados semánticamente)
    const existingPermission = await this.repository.findByActionAndResource(dto.action, dto.resource);
    if (existingPermission) {
      throw new PermissionAlreadyExistsException(dto.action, dto.resource);
    }

    const newPermission = await this.repository.createPermission(dto);
    return newPermission.toResponseJSON();
  }

  // updatePermission => caso de uso "modificar descripción del permiso — PATCH parcial"
  public async updatePermission(id: string, dto: UpdatePermissionDto): Promise<PermissionResponseDto> {
    const existingPermission = await this.repository.findById(id);
    if (!existingPermission) throw new PermissionNotFoundException(id);

    const updatedPermission = await this.repository.updatePermission(id, dto.description);
    return updatedPermission.toResponseJSON();
  }

  // deletePermissionById => caso de uso "eliminar permiso si no está asignado"
  public async deletePermissionById(id: string): Promise<void> {
    const permission = await this.repository.findById(id);
    if (!permission) throw new PermissionNotFoundException(id);

    // La regla "canBeDeleted()" vive en la ENTIDAD de dominio (no en el Service): mantiene la lógica
    // de negocio encapsulada junto al dato que la sustenta (principio de "Rich Domain Model")
    if (!permission.canBeDeleted()) {
      // Antes se enviaba 0 fijo y el mensaje decía "asignado a 0 rol(es)": ahora se informa el conteo real
      throw new PermissionInUseException(permission.rolesCount);
    }

    await this.repository.deletePermissionById(id);
  }
}

export const permissionService = new PermissionService(permissionRepository);
