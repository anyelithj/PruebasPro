# Aula de Idiomas — Remoto Angular 22

Remoto de **Angular 22** que el shell **Next.js** (`apps/frontend-next/`) compone por *rewrites* y **Angular Elements**: mismo origen, misma sesión (cookie httpOnly) y mismo BFF (`/api/*`).

| Documento | Contenido |
|-----------|-----------|
| [`angular-setup.md`](./angular-setup.md) | Crear el proyecto, dependencias, correr el servidor, pruebas y Docker |
| [`angular_estructura.md`](./angular_estructura.md) | Arquitectura y árbol completo de carpetas (igual a la matriz) |

```bash
nvm use 22.22.3 && pnpm install && pnpm start   # http://localhost:9100/ng/  ·  a través del shell: http://localhost:9000/tutor
```

**Pantallas (fases 0–6):** `/tutor` · `/redaccion` · `/estudio/plan` · `/estudio/recomendaciones` · `/notificaciones` · `/reportes/exportaciones` · Angular Elements `<aula-exportar>` y `<aula-campana>`.
