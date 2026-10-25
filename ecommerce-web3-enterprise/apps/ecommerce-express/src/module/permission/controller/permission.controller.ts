// permission.controller.ts => capa HTTP del módulo Permission
import type { Request, Response, NextFunction } from "express";
import { permissionService } from "../service/permission.service";
import { PermissionSchema, UpdatePermissionSchema } from "../schema/permission.schema";

export class PermissionController {
  public async createPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = PermissionSchema.parse(req.body);
      const permission = await permissionService.createPermission(validatedInput);
      res.status(201).json({ success: true, data: permission });
    } catch (error) {
      next(error);
    }
  }

  public async listPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = await permissionService.listPermissions();
      res.status(200).json({ success: true, data: permissions });
    } catch (error) {
      next(error);
    }
  }

  public async getPermissionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"];
      if (!id) {
        res.status(400).json({ success: false, message: "id requerido" });
        return;
      }

      const permission = await permissionService.getPermissionById(id);
      res.status(200).json({ success: true, data: permission });
    } catch (error) {
      next(error);
    }
  }

  public async updatePermission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"];
      if (!id) {
        res.status(400).json({ success: false, message: "id requerido" });
        return;
      }

      const validatedInput = UpdatePermissionSchema.parse(req.body);
      const permission = await permissionService.updatePermission(id, validatedInput);
      res.status(200).json({ success: true, data: permission });
    } catch (error) {
      next(error);
    }
  }

  public async deletePermissionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params["id"];
      if (!id) {
        res.status(400).json({ success: false, message: "id requerido" });
        return;
      }

      await permissionService.deletePermissionById(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const permissionController = new PermissionController();
